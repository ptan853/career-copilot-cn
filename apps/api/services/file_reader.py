"""文件文本提取服务 — PDF、DOCX、TXT 等格式的文本提取

所有函数接收文件路径 / 二进制内容，返回提取的纯文本。
"""

import logging
from pathlib import Path

logger = logging.getLogger("file_reader")


def extract_text(file_path: str, mime_type: str = "") -> str:
    """根据文件路径和 MIME 类型提取文本。"""
    ext = Path(file_path).suffix.lower()

    # 根据 MIME type 或扩展名判断
    if "pdf" in mime_type or ext == ".pdf":
        return _extract_pdf(file_path)
    elif "wordprocessingml" in mime_type or ext in (".docx", ".doc"):
        return _extract_docx(file_path)
    elif "text/plain" in mime_type or ext == ".txt":
        return _extract_txt(file_path)
    elif "markdown" in mime_type or ext == ".md":
        return _extract_txt(file_path)
    else:
        logger.warning("unsupported file type: %s (mime=%s)", ext, mime_type)
        return ""


def _extract_pdf(file_path: str) -> str:
    """使用 PyMuPDF 提取 PDF 文本。"""
    try:
        import fitz

        with fitz.open(file_path) as doc:
            pages: list[str] = []
            for page in doc:
                text = page.get_text("text")
                if text:
                    pages.append(text.strip())
            result = "\n\n".join(pages)
            logger.info("pdf extracted %d chars from %d pages", len(result), doc.page_count)
            return result
    except Exception as e:
        logger.exception("pdf extraction failed: %s", e)
        return ""


def _extract_docx(file_path: str) -> str:
    """使用 python-docx 提取 DOCX 文本。"""
    try:
        from docx import Document
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        result = "\n".join(paragraphs)
        logger.info("docx extracted %d chars, %d paragraphs", len(result), len(paragraphs))
        return result
    except Exception as e:
        logger.exception("docx extraction failed: %s", e)
        return ""


def _extract_txt(file_path: str) -> str:
    """读取纯文本 / Markdown 文件。"""
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
            logger.info("txt extracted %d chars", len(content))
            return content
    except Exception as e:
        logger.exception("txt extraction failed: %s", e)
        return ""
