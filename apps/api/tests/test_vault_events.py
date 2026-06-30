from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from auth_deps import get_current_user_id
from database import get_session
from main import app
from models import CareerEvent, Claim, Evidence, SourceMaterial, User


def _client_for_user(user: User, session: Session) -> TestClient:
    def override_session():
        yield session

    def override_user_id():
        return str(user.id)

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user_id] = override_user_id
    return TestClient(app)


def test_grouped_events_include_section_metadata(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'vault_events.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="group@example.com", display_name="Group User")
        session.add(user)
        session.commit()
        session.refresh(user)

        event = CareerEvent(
            user_id=user.id,
            event_type="internship",
            title="增长产品实习",
            details_json={"section_type": "work", "section_title": "工作经历"},
            status="draft",
        )
        session.add(event)
        session.commit()

        client = _client_for_user(user, session)
        try:
            response = client.get("/api/vault/events?grouped=true")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()["data"]
        assert data[0]["section_type"] == "work"
        assert data[0]["section_title"] == "工作经历"
        assert data[0]["events"][0]["title"] == "增长产品实习"


def test_delete_event_removes_claims_and_evidence(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'delete_event.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="delete@example.com", display_name="Delete User")
        session.add(user)
        session.commit()
        session.refresh(user)

        source = SourceMaterial(user_id=user.id, source_type="text", title="source")
        session.add(source)
        session.commit()
        session.refresh(source)

        event = CareerEvent(user_id=user.id, event_type="project", title="项目", source_id=source.id)
        session.add(event)
        session.commit()
        session.refresh(event)

        claim = Claim(user_id=user.id, career_event_id=event.id, claim_text="做了项目")
        session.add(claim)
        session.commit()
        session.refresh(claim)

        event_evidence = Evidence(
            user_id=user.id,
            source_material_id=source.id,
            career_event_id=event.id,
            claim_id=claim.id,
            quote="做了项目",
        )
        claim_only_evidence = Evidence(
            user_id=user.id,
            source_material_id=source.id,
            claim_id=claim.id,
            quote="claim-only evidence",
        )
        session.add(event_evidence)
        session.add(claim_only_evidence)
        session.commit()

        client = _client_for_user(user, session)
        try:
            response = client.delete(f"/api/vault/events/{event.id}")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert session.get(CareerEvent, event.id) is None
        assert session.exec(select(Claim).where(Claim.career_event_id == event.id)).all() == []
        assert session.exec(select(Evidence).where(Evidence.career_event_id == event.id)).all() == []
        assert session.exec(select(Evidence).where(Evidence.claim_id == claim.id)).all() == []


def test_claim_endpoints_use_uuid_user_scope(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'claim_scope.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="claims@example.com", display_name="Claims User")
        session.add(user)
        session.commit()
        session.refresh(user)

        event = CareerEvent(user_id=user.id, event_type="project", title="项目")
        session.add(event)
        session.commit()
        session.refresh(event)

        client = _client_for_user(user, session)
        try:
            create_response = client.post(
                "/api/vault/claims",
                json={"event_id": str(event.id), "claim_text": "完成核心功能"},
            )
            list_response = client.get(f"/api/vault/claims?event_id={event.id}")
        finally:
            app.dependency_overrides.clear()

        assert create_response.status_code == 200
        assert list_response.status_code == 200
        claims = list_response.json()["data"]
        assert len(claims) == 1
        assert claims[0]["claim_text"] == "完成核心功能"
