"""Career Copilot API V2 — 数据库引擎"""
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session as DBSession

from config import settings

engine = create_engine(settings.database_url, echo=settings.debug)


def get_session():
    with DBSession(engine) as session:
        yield session


def init_db():
    SQLModel.metadata.create_all(engine)
    _ensure_profile_provider_columns()


def _ensure_profile_provider_columns():
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(profiles)")).all()
        if not rows:
            return
        columns = {row[1] for row in rows}
        for column in ("ai_provider_name", "ai_api_base", "ai_model_name"):
            if column not in columns:
                conn.execute(text(f"ALTER TABLE profiles ADD COLUMN {column} VARCHAR"))
