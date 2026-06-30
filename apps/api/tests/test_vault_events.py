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


def test_grouped_custom_sections_keep_distinct_titles(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'custom_sections.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="custom@example.com", display_name="Custom User")
        session.add(user)
        session.commit()
        session.refresh(user)

        session.add(
            CareerEvent(
                user_id=user.id,
                event_type="custom",
                title="社群运营",
                details_json={"section_type": "custom", "section_title": "社群经历"},
                status="draft",
            )
        )
        session.add(
            CareerEvent(
                user_id=user.id,
                event_type="custom",
                title="公开演讲",
                details_json={"section_type": "custom", "section_title": "演讲经历"},
                status="draft",
            )
        )
        session.commit()

        client = _client_for_user(user, session)
        try:
            response = client.get("/api/vault/events?grouped=true")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        sections = response.json()["data"]
        assert {section["section_title"] for section in sections} == {"社群经历", "演讲经历"}
        assert len(sections) == 2


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


def test_delete_event_rejects_cross_user_and_malformed_id(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'delete_guard.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        owner = User(email="owner@example.com", display_name="Owner")
        other = User(email="other@example.com", display_name="Other")
        session.add(owner)
        session.add(other)
        session.commit()
        session.refresh(owner)
        session.refresh(other)

        event = CareerEvent(user_id=owner.id, event_type="project", title="项目")
        session.add(event)
        session.commit()
        session.refresh(event)

        client = _client_for_user(other, session)
        try:
            cross_user_response = client.delete(f"/api/vault/events/{event.id}")
            malformed_response = client.delete("/api/vault/events/not-a-uuid")
        finally:
            app.dependency_overrides.clear()

        assert cross_user_response.status_code == 404
        assert malformed_response.status_code == 404
        assert session.get(CareerEvent, event.id) is not None


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


def test_claim_endpoints_reject_cross_user_event(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'claim_cross_user.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        owner = User(email="claim-owner@example.com", display_name="Owner")
        other = User(email="claim-other@example.com", display_name="Other")
        session.add(owner)
        session.add(other)
        session.commit()
        session.refresh(owner)
        session.refresh(other)

        event = CareerEvent(user_id=owner.id, event_type="project", title="项目")
        session.add(event)
        session.commit()
        session.refresh(event)

        client = _client_for_user(other, session)
        try:
            create_response = client.post(
                "/api/vault/claims",
                json={"event_id": str(event.id), "claim_text": "不应创建"},
            )
            list_response = client.get(f"/api/vault/claims?event_id={event.id}")
        finally:
            app.dependency_overrides.clear()

        assert create_response.status_code == 404
        assert list_response.status_code == 404
        assert session.exec(select(Claim).where(Claim.career_event_id == event.id)).all() == []


def test_claim_update_and_delete_are_user_scoped(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'claim_mutation.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        owner = User(email="claim-edit@example.com", display_name="Owner")
        other = User(email="claim-edit-other@example.com", display_name="Other")
        session.add(owner)
        session.add(other)
        session.commit()
        session.refresh(owner)
        session.refresh(other)

        event = CareerEvent(user_id=owner.id, event_type="project", title="项目")
        session.add(event)
        session.commit()
        session.refresh(event)

        claim = Claim(user_id=owner.id, career_event_id=event.id, claim_text="旧事实")
        session.add(claim)
        session.commit()
        session.refresh(claim)

        other_client = _client_for_user(other, session)
        try:
            cross_update = other_client.patch(f"/api/vault/claims/{claim.id}", json={"claim_text": "越权"})
            cross_delete = other_client.delete(f"/api/vault/claims/{claim.id}")
        finally:
            app.dependency_overrides.clear()

        owner_client = _client_for_user(owner, session)
        try:
            update_response = owner_client.patch(f"/api/vault/claims/{claim.id}", json={"claim_text": "新事实"})
            delete_response = owner_client.delete(f"/api/vault/claims/{claim.id}")
        finally:
            app.dependency_overrides.clear()

        assert cross_update.status_code == 404
        assert cross_delete.status_code == 404
        assert update_response.status_code == 200
        assert update_response.json()["data"]["claim_text"] == "新事实"
        assert delete_response.status_code == 200
        assert session.get(Claim, claim.id) is None
