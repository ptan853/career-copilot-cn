"""Career Copilot API — 数据模型"""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import JSON, Column, Text


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    supabase_user_id: str = Field(unique=True, index=True)
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    locale: str = "zh-CN"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", unique=True, index=True)
    legal_name: Optional[str] = None
    preferred_name: Optional[str] = None
    headline: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location_city: Optional[str] = None
    target_cities: list = Field(default=[], sa_column=Column(JSON))
    target_roles: list = Field(default=[], sa_column=Column(JSON))
    default_locale: str = "zh-CN"
    resume_defaults: dict = Field(default={}, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserLink(SQLModel, table=True):
    __tablename__ = "user_links"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    label: str
    url: str
    link_type: str = "other"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SourceMaterial(SQLModel, table=True):
    __tablename__ = "source_materials"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    source_type: str
    title: str
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    object_key: Optional[str] = None
    source_url: Optional[str] = None
    raw_text: Optional[str] = Field(default=None, sa_column=Column(Text))
    parse_status: str = "uploaded"
    parse_error: Optional[str] = None
    metadata_json: dict = Field(default={}, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CareerEvent(SQLModel, table=True):
    __tablename__ = "career_events"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    source_id: Optional[uuid.UUID] = Field(default=None, foreign_key="source_materials.id")
    event_type: str
    title: str
    organization: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    time_precision: str = "month"
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    details: dict = Field(default={}, sa_column=Column(JSON))
    status: str = "draft"
    visibility: str = "private"
    tags: list = Field(default=[], sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Claim(SQLModel, table=True):
    __tablename__ = "claims"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    event_id: uuid.UUID = Field(foreign_key="career_events.id", index=True)
    text: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class BackgroundJob(SQLModel, table=True):
    __tablename__ = "background_jobs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    job_type: str
    status: str = "queued"
    payload: dict = Field(default={}, sa_column=Column(JSON))
    result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AiRun(SQLModel, table=True):
    __tablename__ = "ai_runs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    feature: str
    provider: str
    model: str
    input_snapshot: dict = Field(sa_column=Column(JSON))
    output_snapshot: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    status: str = "queued"
    error: Optional[str] = None
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    cost_estimate: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class TargetResearch(SQLModel, table=True):
    __tablename__ = "target_research"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    company_context: Optional[str] = None
    role_responsibilities: list = Field(default=[], sa_column=Column(JSON))
    must_have_skills: list = Field(default=[], sa_column=Column(JSON))
    nice_to_have_skills: list = Field(default=[], sa_column=Column(JSON))
    keywords: list = Field(default=[], sa_column=Column(JSON))
    risks: list = Field(default=[], sa_column=Column(JSON))
    recommended_positioning: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResumePlan(SQLModel, table=True):
    __tablename__ = "resume_plans"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    positioning: str
    sections: dict = Field(sa_column=Column(JSON))
    status: str = "draft"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JobTarget(SQLModel, table=True):
    __tablename__ = "job_targets"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    company: Optional[str] = None
    role: Optional[str] = None
    city: Optional[str] = None
    source_url: Optional[str] = None
    source_channel: Optional[str] = None
    jd_raw: Optional[str] = Field(default=None, sa_column=Column(Text))
    jd_hash: Optional[str] = None
    language: str = "zh-CN"
    status: str = "draft"
    priority: str = "normal"
    deadline: Optional[datetime] = None
    tags: list = Field(default=[], sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Artifact(SQLModel, table=True):
    __tablename__ = "artifacts"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    artifact_type: str
    language: str = "zh-CN"
    title: str
    status: str = "draft"
    current_version_id: Optional[uuid.UUID] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ArtifactVersion(SQLModel, table=True):
    __tablename__ = "artifact_versions"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    artifact_id: uuid.UUID = Field(foreign_key="artifacts.id", index=True)
    version: int
    document_json: dict = Field(sa_column=Column(JSON))
    markdown: Optional[str] = None
    html_key: Optional[str] = None
    pdf_key: Optional[str] = None
    docx_key: Optional[str] = None
    source_trace: list = Field(default=[], sa_column=Column(JSON))
    created_by: str = "ai"
    created_at: datetime = Field(default_factory=datetime.utcnow)
