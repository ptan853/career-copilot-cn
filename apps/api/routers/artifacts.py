"""Artifacts 路由 — 文档生成、版本管理、导出"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import (
    Artifact, ArtifactVersion, JobTarget, EvidenceMap, CareerEvent,
    Claim, JDAnalysis,
)
from auth_deps import get_current_user_id

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


# ── Request bodies ──────────────────────────────────────────

class GeneratePlanBody(BaseModel):
    job_target_id: str
    doc_type: str = "resume"
    language: str = "zh-CN"
    template: str = "ats_classic"
    sections: list[str] = ["contact", "summary", "experience", "projects", "skills"]
    evidence_strictness: str = "confirmed"


class UpdateArtifactBody(BaseModel):
    title: Optional[str] = None
    template: Optional[str] = None


class SaveVersionBody(BaseModel):
    structured_json: Optional[dict] = None
    markdown: Optional[str] = None
    html: Optional[str] = None
    change_summary: Optional[str] = None


# ── Serializers ─────────────────────────────────────────────

def _serialize_artifact(a: Artifact) -> dict:
    return {
        "id": str(a.id),
        "job_target_id": str(a.job_target_id),
        "artifact_type": a.artifact_type,
        "title": a.title,
        "language": a.language,
        "template": a.template,
        "current_version_id": str(a.current_version_id) if a.current_version_id else None,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


def _serialize_version(v: ArtifactVersion) -> dict:
    return {
        "id": str(v.id),
        "artifact_id": str(v.artifact_id),
        "version_number": v.version_number,
        "structured_json": v.structured_json,
        "markdown": v.markdown,
        "html": v.html,
        "source_map_json": v.source_map_json,
        "change_summary": v.change_summary,
        "created_by": v.created_by,
        "created_at": v.created_at.isoformat(),
    }


# ── LIST ─────────────────────────────────────────────────────

@router.get("")
def list_artifacts(
    job_target_id: Optional[str] = Query(None),
    artifact_type: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    query = select(Artifact).where(Artifact.user_id == user_id)
    if job_target_id:
        query = query.where(Artifact.job_target_id == job_target_id)
    if artifact_type:
        query = query.where(Artifact.artifact_type == artifact_type)
    query = query.order_by(Artifact.updated_at.desc())
    artifacts = session.exec(query).all()
    return {"data": [_serialize_artifact(a) for a in artifacts]}


# ── GET ──────────────────────────────────────────────────────

@router.get("/{artifact_id}")
def get_artifact(
    artifact_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != user_id:
        raise HTTPException(status_code=404, detail="文档不存在")

    result = _serialize_artifact(artifact)

    # 加载当前版本
    if artifact.current_version_id:
        version = session.get(ArtifactVersion, artifact.current_version_id)
        if version:
            result["current_version"] = _serialize_version(version)

    return {"data": result}


# ── GENERATE PLAN ────────────────────────────────────────────

def _build_resume_structured(
    session: Session,
    job: JobTarget,
    evidence_map: Optional[EvidenceMap],
    jd_analysis: Optional[JDAnalysis],
    sections: list[str],
    language: str,
) -> dict:
    """从证据和 JD 组装结构化的简历内容。这是确定性组装，不是 LLM 生成。"""
    structured: dict = {}

    # Contact
    if "contact" in sections:
        structured["contact"] = {
            "name": "",
            "email": "",
            "phone": "",
            "location": "",
            "links": [],
        }

    # Summary — 基于 JD recommended_narrative
    if "summary" in sections:
        narrative = jd_analysis.recommended_narrative if jd_analysis else ""
        structured["summary"] = narrative or "请根据目标岗位补充个人简介"

    # Experience / Projects — 基于 evidence_map 的 selected_events
    experience = []
    projects = []
    if evidence_map and evidence_map.selected_event_ids:
        for eid in evidence_map.selected_event_ids:
            event = session.get(CareerEvent, eid)
            if not event:
                continue
            claims = session.exec(
                select(Claim).where(Claim.career_event_id == event.id)
            ).all()

            entry = {
                "event_id": str(event.id),
                "title": event.title,
                "role": event.role,
                "organization": event.organization,
                "time_start": event.time_start,
                "time_end": event.time_end,
                "bullets": [cl.claim_text for cl in claims] if claims else [],
                "description": event.description,
            }

            if event.event_type in ("work", "internship"):
                experience.append(entry)
            elif event.event_type == "project":
                projects.append(entry)
            else:
                # 教育/证书等放入 experience 作为补充
                experience.append(entry)

    if "experience" in sections:
        structured["experience"] = experience
    if "projects" in sections:
        structured["projects"] = projects

    # Skills — 基于 JD keywords
    if "skills" in sections:
        keywords = jd_analysis.keywords_json if jd_analysis else []
        structured["skills"] = keywords if keywords else []

    # Courses
    if "courses" in sections:
        structured["courses"] = []

    # Awards
    if "awards" in sections:
        structured["awards"] = []

    return structured


@router.post("/generate", status_code=201)
def generate_artifact(
    body: GeneratePlanBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """根据岗位 + 证据映射生成结构化的文档（resume/cover_letter 等）。"""
    # 验证岗位存在且属于用户
    job = session.get(JobTarget, body.job_target_id)
    if not job or job.user_id != user_id:
        raise HTTPException(status_code=404, detail="岗位不存在")

    # 加载证据映射
    evidence_map = session.exec(
        select(EvidenceMap).where(EvidenceMap.job_target_id == job.id)
    ).first()

    # 加载 JD 分析
    jd_analysis = session.exec(
        select(JDAnalysis).where(JDAnalysis.job_target_id == job.id)
    ).first()

    # 组装结构化内容
    structured = _build_resume_structured(
        session, job, evidence_map, jd_analysis,
        body.sections, body.language,
    )

    # 生成标题
    title = f"{job.company or '未知公司'} · {job.role or '岗位'} — {body.doc_type}"

    # 创建 Artifact
    artifact = Artifact(
        user_id=user_id,
        job_target_id=job.id,
        artifact_type=body.doc_type,
        title=title,
        language=body.language,
        template=body.template,
    )
    session.add(artifact)
    session.flush()

    # 创建版本 1
    version = ArtifactVersion(
        artifact_id=artifact.id,
        version_number=1,
        structured_json=structured,
        created_by="system",
        change_summary="初始生成",
        source_map_json=[str(eid) for eid in (evidence_map.selected_event_ids if evidence_map else [])],
    )
    session.add(version)
    session.flush()

    artifact.current_version_id = version.id
    session.add(artifact)
    session.commit()
    session.refresh(artifact)

    result = _serialize_artifact(artifact)
    result["current_version"] = _serialize_version(version)
    return {"data": result}


# ── PATCH ────────────────────────────────────────────────────

@router.patch("/{artifact_id}")
def update_artifact(
    artifact_id: str,
    body: UpdateArtifactBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != user_id:
        raise HTTPException(status_code=404, detail="文档不存在")
    if body.title is not None:
        artifact.title = body.title
    if body.template is not None:
        artifact.template = body.template
    session.add(artifact)
    session.commit()
    session.refresh(artifact)
    return {"data": _serialize_artifact(artifact), "message": "已更新"}


# ── DELETE ───────────────────────────────────────────────────

@router.delete("/{artifact_id}")
def delete_artifact(
    artifact_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != user_id:
        raise HTTPException(status_code=404, detail="文档不存在")
    session.delete(artifact)
    session.commit()
    return {"message": "已删除", "artifact_id": artifact_id}


# ── VERSIONS ────────────────────────────────────────────────

@router.get("/{artifact_id}/versions")
def list_versions(
    artifact_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != user_id:
        raise HTTPException(status_code=404, detail="文档不存在")

    versions = session.exec(
        select(ArtifactVersion)
        .where(ArtifactVersion.artifact_id == artifact.id)
        .order_by(ArtifactVersion.version_number.desc())
    ).all()
    return {"data": [_serialize_version(v) for v in versions]}


@router.post("/{artifact_id}/versions", status_code=201)
def save_version(
    artifact_id: str,
    body: SaveVersionBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != user_id:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 获取最新版本号
    latest = session.exec(
        select(ArtifactVersion)
        .where(ArtifactVersion.artifact_id == artifact.id)
        .order_by(ArtifactVersion.version_number.desc())
    ).first()
    next_number = (latest.version_number + 1) if latest else 1

    version = ArtifactVersion(
        artifact_id=artifact.id,
        version_number=next_number,
        structured_json=body.structured_json or {},
        markdown=body.markdown,
        html=body.html,
        change_summary=body.change_summary or f"版本 {next_number}",
        created_by="user",
    )
    session.add(version)
    session.flush()

    artifact.current_version_id = version.id
    session.add(artifact)
    session.commit()
    session.refresh(version)
    return {"data": _serialize_version(version), "message": "版本已保存"}
