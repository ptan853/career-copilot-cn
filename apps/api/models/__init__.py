"""Career Copilot CN V2 — 完整数据模型

按照 docs/product-v2/06-data-model.md 定义全部表，所有表均 user-scoped。
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import JSON, Column, Text


# ============================================================
# Auth
# ============================================================

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    display_name: str = "用户"
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    locale: str = "zh-CN"
    timezone: str = "Asia/Shanghai"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None


class AuthIdentity(SQLModel, table=True):
    __tablename__ = "auth_identities"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    provider: str  # email_password / email_code / phone_code / google / wechat / github
    provider_subject: str  # 邮箱地址 / 手机号 / OAuth subject
    password_hash: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VerificationChallenge(SQLModel, table=True):
    __tablename__ = "verification_challenges"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    channel: str = Field(index=True)  # phone / email
    destination: str = Field(index=True)
    code_hash: str
    purpose: str = "login"
    expires_at: datetime
    attempt_count: int = 0
    consumed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Profile
# ============================================================

class Profile(SQLModel, table=True):
    __tablename__ = "profiles"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", unique=True, index=True)
    full_name: Optional[str] = None
    headline: Optional[str] = None
    emails: list = Field(default=[], sa_column=Column(JSON))
    phones: list = Field(default=[], sa_column=Column(JSON))
    location: Optional[str] = None
    target_locations: list = Field(default=[], sa_column=Column(JSON))
    links: list = Field(default=[], sa_column=Column(JSON))
    summary: Optional[str] = Field(default=None, sa_column=Column(Text))
    years_of_experience: Optional[int] = None
    language_preferences: list = Field(default=["zh-CN"], sa_column=Column(JSON))
    target_roles: list = Field(default=[], sa_column=Column(JSON))
    application_answers_json: dict = Field(default={}, sa_column=Column(JSON))
    ai_provider: str = "openai"
    ai_provider_name: Optional[str] = None
    ai_api_base: Optional[str] = None
    ai_model_name: Optional[str] = None
    ai_api_key: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Career Vault
# ============================================================

class SourceMaterial(SQLModel, table=True):
    __tablename__ = "source_materials"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    source_type: str  # file / text / url / extension_capture / backup_restore / agent_session
    title: str
    raw_text: Optional[str] = Field(default=None, sa_column=Column(Text))
    file_url: Optional[str] = None
    source_url: Optional[str] = None
    mime_type: Optional[str] = None
    parse_status: str = "uploaded"  # uploaded / extracting / extracted / parsed / failed
    parse_error: Optional[str] = None
    metadata_json: dict = Field(default={}, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CareerEvent(SQLModel, table=True):
    __tablename__ = "career_events"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    event_type: str  # work / internship / project / education / award / publication / patent / certification / course / competition / open_source / startup / volunteer / language / custom
    title: str
    role: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    time_precision: str = "month"  # day / month / year / unknown
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    details_json: dict = Field(default={}, sa_column=Column(JSON))
    tags: list = Field(default=[], sa_column=Column(JSON))
    status: str = "draft"  # draft / needs_review / confirmed / archived
    visibility: str = "private"  # private / resume / public
    source_confidence: Optional[float] = None
    source_id: Optional[uuid.UUID] = Field(default=None, foreign_key="source_materials.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Claim(SQLModel, table=True):
    __tablename__ = "claims"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    career_event_id: uuid.UUID = Field(foreign_key="career_events.id", index=True)
    claim_text: str
    claim_type: str = "achievement"  # skill / achievement / metric / responsibility / credential / preference
    strength: str = "confirmed"  # confirmed / inferred / weak
    visibility: str = "private"  # private / resume / public
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Evidence(SQLModel, table=True):
    __tablename__ = "evidences"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    source_material_id: uuid.UUID = Field(foreign_key="source_materials.id", index=True)
    career_event_id: Optional[uuid.UUID] = Field(default=None, foreign_key="career_events.id")
    claim_id: Optional[uuid.UUID] = Field(default=None, foreign_key="claims.id")
    quote: Optional[str] = None
    locator_json: dict = Field(default={}, sa_column=Column(JSON))
    confidence: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Job Targets
# ============================================================

class JobTarget(SQLModel, table=True):
    __tablename__ = "job_targets"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    company: Optional[str] = None
    role: Optional[str] = None
    city: Optional[str] = None
    work_mode: Optional[str] = None  # onsite / remote / hybrid
    industry: Optional[str] = None
    source_url: Optional[str] = None
    channel: Optional[str] = None  # boss / liepin / zhilian / 51job / lagou / niuke / shixiseng / maimai / company_site / other
    raw_jd: Optional[str] = Field(default=None, sa_column=Column(Text))
    deadline: Optional[datetime] = None
    priority: str = "normal"  # high / normal / low
    status: str = "draft"  # draft / analyzing / ready / generating / applied / archived
    tags: list = Field(default=[], sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JDAnalysis(SQLModel, table=True):
    __tablename__ = "jd_analyses"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    job_target_id: uuid.UUID = Field(foreign_key="job_targets.id", unique=True, index=True)
    responsibilities_json: list = Field(default=[], sa_column=Column(JSON))
    must_have_json: list = Field(default=[], sa_column=Column(JSON))
    nice_to_have_json: list = Field(default=[], sa_column=Column(JSON))
    keywords_json: list = Field(default=[], sa_column=Column(JSON))
    company_context: Optional[str] = None
    screening_criteria_json: list = Field(default=[], sa_column=Column(JSON))
    risks_json: list = Field(default=[], sa_column=Column(JSON))
    recommended_narrative: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EvidenceMap(SQLModel, table=True):
    __tablename__ = "evidence_maps"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    job_target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    requirement_id: Optional[str] = None
    selected_event_ids: list = Field(default=[], sa_column=Column(JSON))
    selected_claim_ids: list = Field(default=[], sa_column=Column(JSON))
    omitted_event_ids: list = Field(default=[], sa_column=Column(JSON))
    gaps_json: dict = Field(default={}, sa_column=Column(JSON))
    rationale: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Artifacts
# ============================================================

class Artifact(SQLModel, table=True):
    __tablename__ = "artifacts"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    job_target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    artifact_type: str  # resume / cover_letter / email / dm / referral_qa / interview_intro
    title: str
    language: str = "zh-CN"
    template: str = "ats_classic"
    current_version_id: Optional[uuid.UUID] = None
    submitted_version_id: Optional[uuid.UUID] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ArtifactVersion(SQLModel, table=True):
    __tablename__ = "artifact_versions"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    artifact_id: uuid.UUID = Field(foreign_key="artifacts.id", index=True)
    version_number: int = 1
    structured_json: dict = Field(default={}, sa_column=Column(JSON))
    markdown: Optional[str] = None
    html: Optional[str] = None
    source_map_json: list = Field(default=[], sa_column=Column(JSON))
    change_summary: Optional[str] = None
    created_by: str = "ai"  # user / ai / system
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExportFile(SQLModel, table=True):
    __tablename__ = "export_files"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    artifact_version_id: uuid.UUID = Field(foreign_key="artifact_versions.id", index=True)
    format: str  # pdf / docx / markdown / html / txt / json
    file_url: Optional[str] = None
    verification_json: dict = Field(default={}, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Application Tracker
# ============================================================

class Application(SQLModel, table=True):
    __tablename__ = "applications"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    job_target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    status: str = "draft"  # draft / ready_to_apply / applied / online_test / interview / offer / rejected / accepted / declined / archived
    applied_at: Optional[datetime] = None
    resume_artifact_version_id: Optional[uuid.UUID] = None
    channel: Optional[str] = None
    contact_person: Optional[str] = None
    next_action: Optional[str] = None
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    outcome_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InterviewRound(SQLModel, table=True):
    __tablename__ = "interview_rounds"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id", index=True)
    round_type: str = "technical"  # technical / behavioral / hr / case / group / screening
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = "scheduled"  # scheduled / completed / canceled
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    outcome: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Interview Prep
# ============================================================

class InterviewPrepSet(SQLModel, table=True):
    __tablename__ = "interview_prep_sets"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    job_target_id: uuid.UUID = Field(foreign_key="job_targets.id", index=True)
    artifact_version_id: uuid.UUID = Field(foreign_key="artifact_versions.id")
    status: str = "draft"  # draft / generated / reviewed / completed
    summary: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InterviewQuestion(SQLModel, table=True):
    __tablename__ = "interview_questions"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    prep_set_id: uuid.UUID = Field(foreign_key="interview_prep_sets.id", index=True)
    category: str  # self_intro / resume_challenge / project_deep_dive / technical / design / behavioral / motivation / company_biz / hr_comp / question_to_ask
    question: str
    answer_draft: Optional[str] = Field(default=None, sa_column=Column(Text))
    evidence_refs_json: list = Field(default=[], sa_column=Column(JSON))
    user_status: str = "new"  # new / know / weak / needs_review
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Background Jobs & AI
# ============================================================

class BackgroundJob(SQLModel, table=True):
    __tablename__ = "background_jobs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    job_type: str
    status: str = "queued"  # queued / running / succeeded / failed / canceled
    progress_message: Optional[str] = None
    payload: dict = Field(default={}, sa_column=Column(JSON))
    result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AiRun(SQLModel, table=True):
    __tablename__ = "ai_runs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    background_job_id: Optional[uuid.UUID] = Field(default=None, foreign_key="background_jobs.id", index=True)
    feature: str
    provider: str
    model: str
    input_snapshot: dict = Field(default={}, sa_column=Column(JSON))
    output_snapshot: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    status: str = "queued"  # queued / running / succeeded / failed
    error: Optional[str] = None
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    cost_estimate: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
