from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from auth_deps import get_current_user_id
from database import get_session
from main import app
from models import Profile, User


def _client_for_user(user: User, session: Session) -> TestClient:
    def override_session():
        yield session

    def override_user_id():
        return str(user.id)

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user_id] = override_user_id
    return TestClient(app)


def test_update_profile_persists_provider_settings_without_returning_api_key(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'profile_settings.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(display_name="Provider User", email="provider-settings@example.com")
        session.add(user)
        session.commit()
        session.refresh(user)
        session.add(Profile(user_id=user.id, full_name="Provider User"))
        session.commit()

        client = _client_for_user(user, session)
        try:
            response = client.patch(
                "/api/vault/profile",
                json={
                    "ai_provider": "bailian_qwen",
                    "ai_provider_name": "bailian-qwen-plus",
                    "ai_api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "ai_model_name": "qwen-plus",
                    "ai_api_key": "sk-secret",
                },
            )
            assert response.status_code == 200

            profile_response = client.get("/api/vault/profile")
        finally:
            app.dependency_overrides.clear()

        data = profile_response.json()["data"]
        assert data["ai_provider"] == "bailian_qwen"
        assert data["ai_provider_name"] == "bailian-qwen-plus"
        assert data["ai_api_base"] == "https://dashscope.aliyuncs.com/compatible-mode/v1"
        assert data["ai_model_name"] == "qwen-plus"
        assert data["has_ai_api_key"] is True
        assert "ai_api_key" not in data


def test_update_profile_normalizes_structured_links(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'profile_links.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(display_name="Link User", email="links@example.com")
        session.add(user)
        session.commit()
        session.refresh(user)
        session.add(Profile(user_id=user.id, full_name="Link User"))
        session.commit()

        client = _client_for_user(user, session)
        try:
            response = client.patch(
                "/api/vault/profile",
                json={
                    "links": [
                        {
                            "label": "GitHub",
                            "url": "https://github.com/ptan853",
                            "link_type": "github_profile",
                            "show_in_materials": True,
                            "use_for_ai_parsing": True,
                        },
                        "https://www.linkedin.com/in/PeifengTan",
                    ]
                },
            )
            assert response.status_code == 200

            profile_response = client.get("/api/vault/profile")
        finally:
            app.dependency_overrides.clear()

        links = profile_response.json()["data"]["links"]
        assert links == [
            {
                "label": "GitHub",
                "url": "https://github.com/ptan853",
                "link_type": "github_profile",
                "show_in_materials": True,
                "use_for_ai_parsing": True,
                "parse_status": "not_started",
                "last_parse_error": None,
            },
            {
                "label": "LinkedIn",
                "url": "https://www.linkedin.com/in/PeifengTan/",
                "link_type": "linkedin_profile",
                "show_in_materials": True,
                "use_for_ai_parsing": False,
                "parse_status": "not_started",
                "last_parse_error": None,
            },
        ]
