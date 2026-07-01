from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from auth_deps import get_current_user_id
from database import get_session
from main import app
from models import BackgroundJob, CareerEvent, Claim, Evidence, Profile, SourceMaterial, User


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


def test_delete_source_removes_unconfirmed_parse_results_but_keeps_confirmed_events(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'delete_source.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="source-owner@example.com", display_name="Source Owner")
        session.add(user)
        session.commit()
        session.refresh(user)

        source = SourceMaterial(user_id=user.id, source_type="file", title="resume.pdf")
        session.add(source)
        session.commit()
        session.refresh(source)

        event = CareerEvent(user_id=user.id, event_type="work", title="工作", source_id=source.id)
        confirmed_event = CareerEvent(
            user_id=user.id,
            event_type="project",
            title="已确认项目",
            source_id=source.id,
            status="confirmed",
        )
        session.add(event)
        session.add(confirmed_event)
        session.commit()
        session.refresh(event)
        session.refresh(confirmed_event)

        claim = Claim(user_id=user.id, career_event_id=event.id, claim_text="增长 20%")
        confirmed_claim = Claim(user_id=user.id, career_event_id=confirmed_event.id, claim_text="已确认事实")
        session.add(claim)
        session.add(confirmed_claim)
        session.commit()
        session.refresh(claim)
        session.refresh(confirmed_claim)

        evidence = Evidence(
            user_id=user.id,
            source_material_id=source.id,
            career_event_id=event.id,
            claim_id=claim.id,
            quote="增长 20%",
        )
        job = BackgroundJob(
            user_id=user.id,
            job_type="source_parse",
            status="queued",
            payload={"source_id": str(source.id)},
        )
        session.add(evidence)
        session.add(job)
        session.commit()

        client = _client_for_user(user, session)
        try:
            response = client.delete(f"/api/vault/sources/{source.id}")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert session.get(SourceMaterial, source.id) is None
        assert session.get(CareerEvent, event.id) is None
        kept_event = session.get(CareerEvent, confirmed_event.id)
        assert kept_event is not None
        assert kept_event.status == "confirmed"
        assert kept_event.source_id is None
        assert session.get(Claim, claim.id) is None
        assert session.get(Claim, confirmed_claim.id) is not None
        assert session.exec(select(Evidence).where(Evidence.source_material_id == source.id)).all() == []
        assert session.exec(select(BackgroundJob).where(BackgroundJob.id == job.id)).first() is None


def test_clear_vault_removes_only_current_user_vault_data_and_preserves_profile_settings(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'clear_vault.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        owner = User(email="clear-owner@example.com", display_name="Owner")
        other = User(email="clear-other@example.com", display_name="Other")
        session.add(owner)
        session.add(other)
        session.commit()
        session.refresh(owner)
        session.refresh(other)

        owner_profile = Profile(
            user_id=owner.id,
            full_name="Owner",
            headline="Agent Engineer",
            ai_provider="bailian_qwen",
            ai_api_key="sk-owner-provider-key-123456",
        )
        other_profile = Profile(user_id=other.id, full_name="Other")
        owner_source = SourceMaterial(user_id=owner.id, source_type="file", title="owner.pdf")
        other_source = SourceMaterial(user_id=other.id, source_type="file", title="other.pdf")
        session.add(owner_profile)
        session.add(other_profile)
        session.add(owner_source)
        session.add(other_source)
        session.commit()
        session.refresh(owner_source)
        session.refresh(other_source)

        owner_event = CareerEvent(user_id=owner.id, event_type="project", title="Owner event", source_id=owner_source.id)
        other_event = CareerEvent(user_id=other.id, event_type="project", title="Other event", source_id=other_source.id)
        session.add(owner_event)
        session.add(other_event)
        session.commit()
        session.refresh(owner_event)
        session.refresh(other_event)

        owner_claim = Claim(user_id=owner.id, career_event_id=owner_event.id, claim_text="Owner claim")
        other_claim = Claim(user_id=other.id, career_event_id=other_event.id, claim_text="Other claim")
        session.add(owner_claim)
        session.add(other_claim)
        session.commit()
        session.refresh(owner_claim)
        session.refresh(other_claim)

        session.add(Evidence(user_id=owner.id, source_material_id=owner_source.id, career_event_id=owner_event.id))
        session.add(Evidence(user_id=other.id, source_material_id=other_source.id, career_event_id=other_event.id))
        session.add(BackgroundJob(user_id=owner.id, job_type="source_parse", payload={"source_id": str(owner_source.id)}))
        session.add(BackgroundJob(user_id=other.id, job_type="source_parse", payload={"source_id": str(other_source.id)}))
        session.commit()

        client = _client_for_user(owner, session)
        try:
            response = client.post("/api/vault/clear")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        preserved_profile = session.exec(select(Profile).where(Profile.user_id == owner.id)).first()
        assert preserved_profile is not None
        assert preserved_profile.full_name == "Owner"
        assert preserved_profile.headline == "Agent Engineer"
        assert preserved_profile.ai_provider == "bailian_qwen"
        assert preserved_profile.ai_api_key == "sk-owner-provider-key-123456"
        assert session.exec(select(SourceMaterial).where(SourceMaterial.user_id == owner.id)).all() == []
        assert session.exec(select(CareerEvent).where(CareerEvent.user_id == owner.id)).all() == []
        assert session.exec(select(Claim).where(Claim.user_id == owner.id)).all() == []
        assert session.exec(select(Evidence).where(Evidence.user_id == owner.id)).all() == []
        assert session.exec(select(BackgroundJob).where(BackgroundJob.user_id == owner.id)).all() == []

        assert session.exec(select(Profile).where(Profile.user_id == other.id)).first() is not None
        assert session.exec(select(SourceMaterial).where(SourceMaterial.user_id == other.id)).all() != []
        assert session.exec(select(CareerEvent).where(CareerEvent.user_id == other.id)).all() != []
