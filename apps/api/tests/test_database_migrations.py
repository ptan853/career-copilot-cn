from sqlalchemy import text
from sqlmodel import SQLModel, create_engine

import database


def test_init_db_adds_provider_columns_to_existing_profiles_table(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}", echo=False)
    monkeypatch.setattr(database, "engine", engine)

    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE profiles (
                id CHAR(32) PRIMARY KEY,
                user_id CHAR(32) NOT NULL,
                full_name VARCHAR,
                links JSON,
                ai_provider VARCHAR,
                ai_api_key VARCHAR,
                created_at DATETIME,
                updated_at DATETIME
            )
        """))

    database.init_db()

    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(profiles)")).all()}

    assert "ai_provider_name" in columns
    assert "ai_api_base" in columns
    assert "ai_model_name" in columns
