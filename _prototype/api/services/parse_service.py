"""Career Copilot API — 解析服务"""
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF


def extract_text_from_file(file_path: str, mime_type: str) -> Optional[str]:
    """从文件提取纯文本"""
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext in (".docx",):
        return _extract_docx(file_path)
    elif ext in (".txt", ".md"):
        return Path(file_path).read_text("utf-8", errors="ignore")
    elif ext in (".png", ".jpg", ".jpeg"):
        return None  # 扫描件，需要 OCR 或 LLM vision
    return None


def _extract_pdf(path: str) -> str:
    texts = []
    with fitz.open(path) as doc:
        for page in doc:
            texts.append(page.get_text())
    return "\n".join(texts)


def _extract_docx(path: str) -> str:
    from docx import Document
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs)
