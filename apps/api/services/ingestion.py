"""Local material ingestion for text, files, and URLs."""

from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field

from services.file_reader import extract_text


class IngestionError(RuntimeError):
    pass


class IngestedDocument(BaseModel):
    source_type: Literal["text", "file", "url"]
    title: str | None = None
    content: str
    content_type: Literal["markdown", "text"]
    source_url: str | None = None
    file_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


def ingest_text(text: str, title: str | None = None) -> IngestedDocument:
    return IngestedDocument(
        source_type="text",
        title=title,
        content=text,
        content_type="text",
        metadata={"extraction_method": "direct"},
    )


def ingest_file(file_path: str, mime_type: str = "", title: str | None = None) -> IngestedDocument:
    markdown = _markitdown_convert(file_path)
    if markdown.strip():
        return IngestedDocument(
            source_type="file",
            title=title or Path(file_path).name,
            content=markdown.strip(),
            content_type="markdown",
            file_path=file_path,
            metadata={"extraction_method": "markitdown"},
        )

    fallback = extract_text(file_path, mime_type)
    warnings = [] if fallback.strip() else ["文件内容为空或无法解析"]
    return IngestedDocument(
        source_type="file",
        title=title or Path(file_path).name,
        content=fallback.strip(),
        content_type="text",
        file_path=file_path,
        metadata={"extraction_method": "fallback"},
        warnings=warnings,
    )


def ingest_url(url: str) -> IngestedDocument:
    try:
        with _http_client() as client:
            response = client.get(
                url,
                headers={"User-Agent": "QiuSuo-Copilot/1.0 (material-ingestion)"},
            )
            response.raise_for_status()
    except Exception as exc:
        raise IngestionError(f"无法读取链接: {url}") from exc

    title, text = _extract_html_text(response.text)
    if not text.strip():
        raise IngestionError(f"无法从链接提取正文: {url}")
    return IngestedDocument(
        source_type="url",
        title=title or url,
        content=text,
        content_type="text",
        source_url=url,
        metadata={"extraction_method": "httpx_html"},
    )


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=20, follow_redirects=True)


def _markitdown_convert(file_path: str) -> str:
    try:
        from markitdown import MarkItDown  # type: ignore
    except Exception:
        return ""

    try:
        result = MarkItDown().convert(file_path)
        text_content = getattr(result, "text_content", None)
        if text_content:
            return str(text_content)
        markdown = getattr(result, "markdown", None)
        if markdown:
            return str(markdown)
    except Exception:
        return ""
    return ""


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title_parts: list[str] = []
        self.parts: list[str] = []
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag in {"p", "br", "div", "section", "article", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str):
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in {"p", "div", "section", "article", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")

    def handle_data(self, data: str):
        text = " ".join(data.split())
        if not text or self._skip_depth:
            return
        if self._in_title:
            self.title_parts.append(text)
        else:
            self.parts.append(text)


def _extract_html_text(html: str) -> tuple[str, str]:
    parser = _HTMLTextExtractor()
    parser.feed(html)
    title = " ".join(parser.title_parts).strip()
    lines = []
    for line in "".join(parser.parts).splitlines():
        clean = " ".join(line.split())
        if clean:
            lines.append(clean)
    return title, "\n".join(lines)
