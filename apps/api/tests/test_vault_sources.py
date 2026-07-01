from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
import uuid

from auth_deps import get_current_user_id
from database import get_session
from main import app
from models import SourceMaterial, User
from services.ingestion import IngestedDocument


def _client_for_user(user: User, session: Session) -> TestClient:
    def override_session():
        yield session

    def override_user_id():
        return str(user.id)

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user_id] = override_user_id
    return TestClient(app)


def test_upload_source_uses_ingestion_document_content(monkeypatch, tmp_path):
    from routers import vault_sources

    engine = create_engine(f"sqlite:///{tmp_path / 'vault_sources.db'}", echo=False)
    SQLModel.metadata.create_all(engine)

    def fake_ingest_file(file_path: str, mime_type: str, title: str | None = None):
        return IngestedDocument(
            source_type="file",
            title=title,
            content="# Parsed Resume\n负责增长实验设计",
            content_type="markdown",
            file_path=file_path,
            metadata={"extraction_method": "markitdown"},
        )

    monkeypatch.setattr(vault_sources, "ingest_file", fake_ingest_file)

    with Session(engine) as session:
        user = User(display_name="Upload User", email="upload@example.com")
        session.add(user)
        session.commit()
        session.refresh(user)

        client = _client_for_user(user, session)
        try:
            response = client.post(
                "/api/vault/sources/upload",
                files={"file": ("resume.pdf", b"%PDF fake", "application/pdf")},
            )
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        source = session.get(SourceMaterial, uuid.UUID(response.json()["source_id"]))
        assert source.raw_text == "# Parsed Resume\n负责增长实验设计"
        assert source.parse_status == "extracted"
        assert source.metadata_json["extraction_method"] == "markitdown"


def test_schedule_source_parse_registers_background_worker(monkeypatch):
    from routers import vault_sources

    scheduled = []

    class FakeBackgroundTasks:
        def add_task(self, fn, *args, **kwargs):
            scheduled.append(fn)

    monkeypatch.setattr(vault_sources, "_run_source_parse_worker_once", lambda: None)

    vault_sources._schedule_source_parse(FakeBackgroundTasks())

    assert len(scheduled) == 1
    assert scheduled[0] is vault_sources._run_source_parse_worker_once
