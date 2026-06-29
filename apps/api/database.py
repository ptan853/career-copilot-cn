"""Career Copilot API V2 — 数据库引擎"""
from sqlmodel import SQLModel, create_engine, Session as DBSession

from config import settings

engine = create_engine(settings.database_url, echo=settings.debug)


def get_session():
    with DBSession(engine) as session:
        yield session


def init_db():
    SQLModel.metadata.create_all(engine)
