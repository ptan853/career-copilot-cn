"""Job Targets 路由 V2 — 完整 CRUD"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import JobTarget, JDAnalysis, EvidenceMap, Evidence, CareerEvent
from auth_deps import get_current_user_id
from services.evidence_mapper import match_and_map

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


# ── Request bodies ──────────────────────────────────────────

class CreateJobBody(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    city: Optional[str] = None
    work_mode: Optional[str] = None
    industry: Optional[str] = None
    source_url: Optional[str] = None
    channel: Optional[str] = None
    raw_jd: Optional[str] = None
    deadline: Optional[str] = None
    priority: str = "normal"
    tags: Optional[list] = None


class UpdateJobBody(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    city: Optional[str] = None
    work_mode: Optional[str] = None
    industry: Optional[str] = None
    source_url: Optional[str] = None
    channel: Optional[str] = None
    raw_jd: Optional[str] = None
    deadline: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[list] = None


# ── Serializer ──────────────────────────────────────────────

def _serialize_job(j: JobTarget) -> dict:
    return {
        "id": str(j.id),
        "company": j.company,
        "role": j.role,
        "city": j.city,
        "work_mode": j.work_mode,
        "industry": j.industry,
        "source_url": j.source_url,
        "channel": j.channel,
        "raw_jd": j.raw_jd,
        "deadline": j.deadline.isoformat() if j.deadline else None,
        "priority": j.priority,
        "status": j.status,
        "tags": j.tags or [],
        "created_at": j.created_at.isoformat(),
        "updated_at": j.updated_at.isoformat(),
    }


# ── CREATE ──────────────────────────────────────────────────

@router.post("", status_code=201)
def create_job(
    body: CreateJobBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    deadline = None
    if body.deadline:
        try:
            deadline = datetime.fromisoformat(body.deadline)
        except ValueError:
            raise HTTPException(status_code=400, detail="deadline 格式无效，请使用 ISO 8601")

    job = JobTarget(
        user_id=user_id,
        company=body.company,
        role=body.role,
        city=body.city,
        work_mode=body.work_mode,
        industry=body.industry,
        source_url=body.source_url,
        channel=body.channel,
        raw_jd=body.raw_jd,
        deadline=deadline,
        priority=body.priority,
        tags=body.tags or [],
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return {"data": _serialize_job(job)}


# ── LIST + FILTER ───────────────────────────────────────────

@router.get("")
def list_jobs(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    query = select(JobTarget).where(JobTarget.user_id == user_id)

    if status:
        query = query.where(JobTarget.status == status)
    if priority:
        query = query.where(JobTarget.priority == priority)
    if channel:
        query = query.where(JobTarget.channel == channel)

    query = query.order_by(JobTarget.updated_at.desc())
    jobs = session.exec(query).all()
    return {"data": [_serialize_job(j) for j in jobs]}


# ── GET BY ID ───────────────────────────────────────────────

@router.get("/{job_id}")
def get_job(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    job = session.get(JobTarget, job_id)
    if not job or str(job.user_id) != user_id:
        raise HTTPException(status_code=404, detail="岗位不存在")

    # 顺带查 JDAnalysis（如果存在）
    jd_analysis = session.exec(
        select(JDAnalysis).where(JDAnalysis.job_target_id == job.id)
    ).first()

    result = _serialize_job(job)

    if jd_analysis:
        result["jd_analysis"] = {
            "id": str(jd_analysis.id),
            "responsibilities": jd_analysis.responsibilities_json,
            "must_have": jd_analysis.must_have_json,
            "nice_to_have": jd_analysis.nice_to_have_json,
            "keywords": jd_analysis.keywords_json,
            "company_context": jd_analysis.company_context,
            "recommended_narrative": jd_analysis.recommended_narrative,
        }

    # 顺带查 EvidenceMap（如果存在）
    evidence_map = session.exec(
        select(EvidenceMap).where(EvidenceMap.job_target_id == job.id)
    ).first()

    if evidence_map:
        result["evidence_map"] = {
            "id": str(evidence_map.id),
            "selected_event_ids": evidence_map.selected_event_ids,
            "selected_claim_ids": evidence_map.selected_claim_ids,
            "omitted_event_ids": evidence_map.omitted_event_ids,
            "gaps": evidence_map.gaps_json,
        }

    return {"data": result}


# ── PATCH ───────────────────────────────────────────────────

@router.patch("/{job_id}")
def update_job(
    job_id: str,
    body: UpdateJobBody,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    job = session.get(JobTarget, job_id)
    if not job or str(job.user_id) != user_id:
        raise HTTPException(status_code=404, detail="岗位不存在")

    update_data = body.model_dump(exclude_none=True)

    if "deadline" in update_data:
        raw = update_data["deadline"]
        if raw is not None:
            try:
                update_data["deadline"] = datetime.fromisoformat(raw)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="deadline 格式无效，请使用 ISO 8601")

    for key, val in update_data.items():
        setattr(job, key, val)

    job.updated_at = datetime.utcnow()
    session.add(job)
    session.commit()
    session.refresh(job)
    return {"data": _serialize_job(job), "message": "已更新"}


# ── DELETE ──────────────────────────────────────────────────

@router.delete("/{job_id}")
def delete_job(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    job = session.get(JobTarget, job_id)
    if not job or str(job.user_id) != user_id:
        raise HTTPException(status_code=404, detail="岗位不存在")
    session.delete(job)
    session.commit()
    return {"message": "已删除", "job_id": job_id}


# ── Evidence Mapping ─────────────────────────────────────────

@router.post("/{job_id}/evidence-map")
def create_evidence_map(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """触发证据映射：匹配用户事件与岗位要求，生成 EvidenceMap"""
    try:
        em = match_and_map(session, job_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"data": {
        "id": str(em.id),
        "selected_event_ids": em.selected_event_ids,
        "omitted_event_ids": em.omitted_event_ids,
        "gaps": em.gaps_json,
        "rationale": em.rationale,
    }}


@router.get("/{job_id}/evidence-map")
def get_evidence_map(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """获取岗位的证据映射"""
    # 验证岗位存在且属于用户
    job = session.get(JobTarget, job_id)
    if not job or str(job.user_id) != user_id:
        raise HTTPException(status_code=404, detail="岗位不存在")

    em = session.exec(
        select(EvidenceMap).where(EvidenceMap.job_target_id == job_id)
    ).first()

    if not em:
        return {"data": None}

    # 加载 selected event 详情
    selected_events = []
    for eid in em.selected_event_ids:
        ev = session.get(CareerEvent, eid)
        if ev:
            selected_events.append({
                "id": str(ev.id),
                "event_type": ev.event_type,
                "title": ev.title,
                "organization": ev.organization,
                "description": ev.description[:120] if ev.description else None,
            })

    omitted_events = []
    for eid in em.omitted_event_ids:
        ev = session.get(CareerEvent, eid)
        if ev:
            omitted_events.append({
                "id": str(ev.id),
                "event_type": ev.event_type,
                "title": ev.title,
            })

    # 加载 Evidence 行
    evidence_rows = session.exec(
        select(Evidence).where(Evidence.user_id == user_id, Evidence.claim_id == None)
        .where(Evidence.career_event_id.in_([eid for eid in em.selected_event_ids]))
    ).all()

    return {"data": {
        "id": str(em.id),
        "selected_event_ids": em.selected_event_ids,
        "omitted_event_ids": em.omitted_event_ids,
        "gaps": em.gaps_json,
        "rationale": em.rationale,
        "selected_events": selected_events,
        "omitted_events": omitted_events,
        "evidence_count": len(evidence_rows),
    }}
