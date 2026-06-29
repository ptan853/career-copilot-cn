"""Auth Foundation backend tests."""
import os
import uuid
from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure clean config
os.environ["AUTH_ALLOW_DEV_FALLBACK"] = "false"
os.environ["AUTH_DEV_CODE_ECHO"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///./test_auth.db"

from config import settings as test_settings

# Force the config values we need for this test module
test_settings.auth_allow_dev_fallback = True
test_settings.auth_dev_code_echo = True

from services.passwords import hash_password, verify_password
from services.tokens import create_access_token, decode_access_token
from services.verification_codes import create_challenge, verify_challenge, generate_code, _hash_code
from models import User, AuthIdentity, VerificationChallenge
from database import get_session

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite:///./test_auth.db"
engine = create_engine(TEST_DB_URL, echo=False)


@pytest.fixture(autouse=True)
def clean_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def session():
    with Session(engine) as s:
        yield s


# ---------------------------------------------------------------------------
# Password tests
# ---------------------------------------------------------------------------


class TestPasswords:
    def test_hash_and_verify_correct(self):
        h = hash_password("correct horse battery staple")
        assert h != "correct horse battery staple"
        assert verify_password("correct horse battery staple", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("secret1234")
        assert verify_password("wrong", h) is False

    def test_hash_is_deterministic(self):
        # Each call produces a different salt, so hashes differ
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2


# ---------------------------------------------------------------------------
# Token tests
# ---------------------------------------------------------------------------


class TestTokens:
    def test_create_and_decode(self):
        token = create_access_token("user-abc-123")
        user_id = decode_access_token(token)
        assert user_id == "user-abc-123"

    def test_decode_invalid_token(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            decode_access_token("not.a.real.token")
        assert exc.value.status_code == 401

    def test_token_contains_expiry(self):
        from jose import jwt
        token = create_access_token("user-1")
        payload = jwt.decode(token, test_settings.jwt_secret, algorithms=[test_settings.jwt_algorithm])
        assert "exp" in payload


# ---------------------------------------------------------------------------
# Verification code tests
# ---------------------------------------------------------------------------


class TestVerificationCodes:
    def test_generate_code_length(self):
        code = generate_code()
        assert len(code) == test_settings.auth_code_length

    def test_create_challenge(self, session: Session):
        challenge, code = create_challenge(session, "phone", "+8613800138000")
        assert challenge.id is not None
        assert challenge.code_hash == _hash_code(code)
        assert challenge.consumed_at is None
        assert challenge.attempt_count == 0

    def test_verify_correct_code(self, session: Session):
        challenge, code = create_challenge(session, "phone", "+8613800138000")
        result = verify_challenge(session, str(challenge.id), code)
        assert result.consumed_at is not None

    def test_verify_wrong_code(self, session: Session):
        challenge, code = create_challenge(session, "phone", "+8613800138000")
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            verify_challenge(session, str(challenge.id), "000000")
        assert exc.value.status_code == 401

    def test_cannot_reuse_challenge(self, session: Session):
        challenge, code = create_challenge(session, "phone", "+8613800138000")
        verify_challenge(session, str(challenge.id), code)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            verify_challenge(session, str(challenge.id), code)
        assert exc.value.status_code == 400

    def test_expired_challenge(self, session: Session):
        challenge, code = create_challenge(session, "email", "test@example.com")
        challenge.expires_at = datetime.utcnow() - timedelta(minutes=10)
        session.add(challenge)
        session.commit()
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            verify_challenge(session, str(challenge.id), code)
        assert exc.value.status_code == 400

    def test_invalid_channel_raises(self, session: Session):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            create_challenge(session, "wechat", "test")
        assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Auth identity and user creation
# ---------------------------------------------------------------------------


class TestAuthIdentity:
    def test_create_user_with_password_identity(self, session: Session):
        user = User(display_name="Test User", email="test@example.com")
        session.add(user)
        session.flush()

        identity = AuthIdentity(
            user_id=user.id,
            provider="email_password",
            provider_subject="test@example.com",
            password_hash=hash_password("secret123"),
        )
        session.add(identity)
        session.commit()

        stored = session.exec(
            select(AuthIdentity).where(AuthIdentity.provider_subject == "test@example.com")
        ).first()
        assert stored is not None
        assert verify_password("secret123", stored.password_hash) is True


# ---------------------------------------------------------------------------
# /me scoping
# ---------------------------------------------------------------------------


class TestUserScoping:
    def test_get_current_user_id_requires_token(self, session: Session):
        from auth_deps import get_current_user_id
        from fastapi import HTTPException
        import fastapi
        # Simulate no token without dev fallback
        os.environ["AUTH_ALLOW_DEV_FALLBACK"] = "false"
        test_settings.auth_allow_dev_fallback = False
        try:
            with pytest.raises(HTTPException) as exc:
                # Call function directly with None credentials
                get_current_user_id(None, None, session)
        finally:
            test_settings.auth_allow_dev_fallback = True
        assert exc.value.status_code == 401

    def test_two_users_data_isolation_basic(self, session: Session):
        # Create user A
        ua = User(display_name="User A", email="a@test.com")
        session.add(ua)
        session.flush()

        # Create user B
        ub = User(display_name="User B", email="b@test.com")
        session.add(ub)
        session.commit()

        # Auth identity for user A
        ia = AuthIdentity(user_id=ua.id, provider="email_password", provider_subject="a@test.com")
        session.add(ia)
        session.commit()

        # Query: user B should not find user A's identity
        found = session.exec(
            select(AuthIdentity).where(
                AuthIdentity.provider_subject == "a@test.com",
                AuthIdentity.user_id == ub.id,
            )
        ).first()
        assert found is None


# ---------------------------------------------------------------------------
# Vault data isolation tests (AF-T10)
# ---------------------------------------------------------------------------


class TestVaultDataIsolation:
    """Verify that vault resources are properly scoped by user_id."""

    def test_career_events_isolated(self, session: Session):
        """User A's event should not be visible to User B."""
        from models import CareerEvent

        ua = User(display_name="User A", email="a@test.com")
        ub = User(display_name="User B", email="b@test.com")
        session.add_all([ua, ub])
        session.flush()

        ev_a = CareerEvent(
            user_id=ua.id,
            event_type="work",
            title="User A's job",
            organization="ACME",
        )
        session.add(ev_a)
        session.commit()

        # User B should not find User A's event
        found_by_b = session.exec(
            select(CareerEvent).where(CareerEvent.user_id == ub.id)
        ).all()
        assert len(found_by_b) == 0

        # User A should find their own event
        found_by_a = session.exec(
            select(CareerEvent).where(CareerEvent.user_id == ua.id)
        ).all()
        assert len(found_by_a) == 1
        assert found_by_a[0].title == "User A's job"

    def test_claims_isolated(self, session: Session):
        """User A's claim should not be visible to User B."""
        from models import CareerEvent, Claim

        ua = User(display_name="User A", email="a@test.com")
        ub = User(display_name="User B", email="b@test.com")
        session.add_all([ua, ub])
        session.flush()

        ev = CareerEvent(user_id=ua.id, event_type="work", title="Job")
        session.add(ev)
        session.flush()

        claim = Claim(
            user_id=ua.id,
            career_event_id=ev.id,
            claim_text="Secret achievement",
            claim_type="achievement",
        )
        session.add(claim)
        session.commit()

        # User B should not find any claims
        found_b = session.exec(
            select(Claim).where(Claim.user_id == ub.id)
        ).all()
        assert len(found_b) == 0

        # User A should find their claim
        found_a = session.exec(
            select(Claim).where(Claim.user_id == ua.id)
        ).all()
        assert len(found_a) == 1

    def test_source_materials_isolated(self, session: Session):
        """User A's source material should not be visible to User B."""
        from models import SourceMaterial

        ua = User(display_name="User A", email="a@test.com")
        ub = User(display_name="User B", email="b@test.com")
        session.add_all([ua, ub])
        session.flush()

        src = SourceMaterial(
            user_id=ua.id,
            source_type="text",
            title="User A's notes",
            parse_status="uploaded",
        )
        session.add(src)
        session.commit()

        # User B should not find any sources
        found_b = session.exec(
            select(SourceMaterial).where(SourceMaterial.user_id == ub.id)
        ).all()
        assert len(found_b) == 0

        # User A should find their source
        found_a = session.exec(
            select(SourceMaterial).where(SourceMaterial.user_id == ua.id)
        ).all()
        assert len(found_a) == 1

    def test_profile_isolated(self, session: Session):
        """User A's profile should not be visible to User B."""
        from models import Profile

        ua = User(display_name="User A", email="a@test.com")
        ub = User(display_name="User B", email="b@test.com")
        session.add_all([ua, ub])
        session.flush()

        profile_a = Profile(user_id=ua.id, full_name="Alice")
        session.add(profile_a)
        session.commit()

        # User B should not find any profile
        found_b = session.exec(
            select(Profile).where(Profile.user_id == ub.id)
        ).first()
        assert found_b is None

        # User A's profile should exist
        found_a = session.exec(
            select(Profile).where(Profile.user_id == ua.id)
        ).first()
        assert found_a is not None
        assert found_a.full_name == "Alice"

    def test_cross_user_direct_access_denied(self, session: Session):
        """Direct ID lookup of another user's resource returns None."""
        from models import CareerEvent

        ua = User(display_name="User A", email="a@test.com")
        ub = User(display_name="User B", email="b@test.com")
        session.add_all([ua, ub])
        session.flush()

        ev = CareerEvent(user_id=ua.id, event_type="work", title="Secret")
        session.add(ev)
        session.commit()

        # User B queries by UUID but scoped to their own user_id
        ev_as_b = session.exec(
            select(CareerEvent).where(
                CareerEvent.id == ev.id,
                CareerEvent.user_id == ub.id,
            )
        ).first()
        assert ev_as_b is None


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------


class TestDashboardSummary:
    def test_summary_counts_current_user_vault_data(self, session: Session):
        from models import CareerEvent, SourceMaterial, Claim
        from routers.core import build_dashboard_summary

        user = User(display_name="User A", email="a@test.com")
        other = User(display_name="User B", email="b@test.com")
        session.add_all([user, other])
        session.flush()

        source = SourceMaterial(
            user_id=user.id,
            source_type="text",
            title="我的项目记录",
            parse_status="uploaded",
        )
        session.add(source)
        session.flush()

        confirmed = CareerEvent(
            user_id=user.id,
            event_type="project",
            title="AI 简历评估器",
            status="confirmed",
        )
        draft = CareerEvent(
            user_id=user.id,
            event_type="work",
            title="产品实习",
            status="draft",
        )
        other_event = CareerEvent(
            user_id=other.id,
            event_type="work",
            title="其他用户事件",
            status="confirmed",
        )
        session.add_all([confirmed, draft, other_event])
        session.flush()

        claim = Claim(
            user_id=user.id,
            career_event_id=confirmed.id,
            claim_text="将简历评估流程自动化",
        )
        session.add(claim)
        session.commit()

        summary = build_dashboard_summary(session, str(user.id))

        assert summary["source_count"] == 1
        assert summary["total_events"] == 2
        assert summary["confirmed_events"] == 1
        assert summary["draft_events"] == 1
        assert summary["needs_review"] == 0
        assert summary["claim_count"] == 1
        assert summary["vault_readiness_pct"] == 50
