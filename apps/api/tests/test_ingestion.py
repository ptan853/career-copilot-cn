import httpx
import pytest


def test_ingest_text_returns_plain_document():
    from services.ingestion import ingest_text

    doc = ingest_text("负责增长实验设计", title="补充材料")

    assert doc.source_type == "text"
    assert doc.title == "补充材料"
    assert doc.content == "负责增长实验设计"
    assert doc.content_type == "text"


def test_ingest_file_uses_existing_fallback_extractor(monkeypatch, tmp_path):
    from services import ingestion

    file_path = tmp_path / "resume.pdf"
    file_path.write_bytes(b"%PDF fake")

    monkeypatch.setattr(ingestion, "_markitdown_convert", lambda path: "")
    monkeypatch.setattr(ingestion, "extract_text", lambda path, mime: "PDF fallback text")

    doc = ingestion.ingest_file(str(file_path), "application/pdf", title="resume.pdf")

    assert doc.source_type == "file"
    assert doc.title == "resume.pdf"
    assert doc.content == "PDF fallback text"
    assert doc.content_type == "text"
    assert doc.file_path == str(file_path)
    assert doc.metadata["extraction_method"] == "fallback"


def test_ingest_url_fetches_and_cleans_html(monkeypatch):
    from services import ingestion

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="<html><head><title>项目页</title><script>ignore()</script></head>"
            "<body><nav>菜单</nav><h1>AI Resume Evaluator</h1><p>负责简历评估和反馈生成。</p></body></html>",
        )

    monkeypatch.setattr(ingestion, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))

    doc = ingestion.ingest_url("https://example.com/project")

    assert doc.source_type == "url"
    assert doc.title == "项目页"
    assert doc.source_url == "https://example.com/project"
    assert "AI Resume Evaluator" in doc.content
    assert "负责简历评估和反馈生成" in doc.content
    assert "ignore()" not in doc.content


def test_ingest_url_fetch_failure_raises_clear_error(monkeypatch):
    from services import ingestion
    from services.ingestion import IngestionError

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="blocked")

    monkeypatch.setattr(ingestion, "_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))

    with pytest.raises(IngestionError) as exc:
        ingestion.ingest_url("https://example.com/private")

    assert "无法读取链接" in str(exc.value)
