"""证据映射服务 — keyword-based matching engine
从 JD 和 JDAnalysis 中提取关键词，与用户的 CareerEvent 做匹配，
生成 EvidenceMap + Evidence 行，标注缺口。
"""

import logging
import re
from typing import Optional

from sqlmodel import Session, select

from models import JobTarget, JDAnalysis, CareerEvent, EvidenceMap, Evidence, Claim

logger = logging.getLogger("evidence_mapper")


def match_and_map(session: Session, job_target_id: str, user_id) -> EvidenceMap:
    """为主流程：对指定岗位执行证据映射，返回生成的 EvidenceMap。"""
    # 1. 加载岗位
    job = session.get(JobTarget, job_target_id)
    if not job or job.user_id != user_id:
        raise ValueError("岗位不存在")

    # 2. 提取关键词
    keywords = _extract_keywords(session, job)

    # 3. 加载用户所有状态非 archived 的事件以及 claims
    events = session.exec(
        select(CareerEvent)
        .where(CareerEvent.user_id == user_id, CareerEvent.status != "archived")
    ).all()

    if not events:
        return _create_empty_map(session, job_target_id)

    # 4. 对每个事件打分
    scored = []
    for ev in events:
        score = _score_event(keywords, ev)
        if score > 0:
            scored.append((ev, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    # 5. 选择事件（取 Top N，score > 0.3）
    selected = [e for e, s in scored if s >= 0.3]
    omitted = [e for e, s in scored if s < 0.3]

    # 6. 识别缺口：每个 keyword 如果没有任何事件匹配则记为 gap
    gaps = _detect_gaps(keywords, selected)

    # 7. 清除旧的 EvidenceMap + Evidence
    old_map = session.exec(
        select(EvidenceMap).where(EvidenceMap.job_target_id == job_target_id)
    ).all()
    for em in old_map:
        old_ev = session.exec(
            select(Evidence).where(Evidence.source_material_id == em.job_target_id)
        ).all()
        for e in old_ev:
            session.delete(e)
        session.delete(em)
    session.flush()

    # 8. 写新的 EvidenceMap
    evidence_map = EvidenceMap(
        job_target_id=job_target_id,
        selected_event_ids=[str(e.id) for e in selected],
        omitted_event_ids=[str(e.id) for e in omitted],
        gaps_json=gaps,
        rationale=_build_rationale(keywords, selected),
    )
    session.add(evidence_map)
    session.flush()

    # 9. 为每个 selected event 创建 Evidence 行（如果有关联的 source_id）
    for ev in selected:
        if ev.source_id:
            # 找该事件的 claims
            claims = session.exec(
                select(Claim).where(Claim.career_event_id == ev.id)
            ).all()

            evidence = Evidence(
                user_id=user_id,
                source_material_id=ev.source_id,
                career_event_id=ev.id,
                confidence=_score_event(keywords, ev),
                quote=ev.description[:300] if ev.description else None,
            )
            session.add(evidence)

            # 如果有 claims，也建立证据链接
            if claims:
                for cl in claims:
                    evidence_cl = Evidence(
                        user_id=user_id,
                        source_material_id=ev.source_id,
                        career_event_id=ev.id,
                        claim_id=cl.id,
                        confidence=_score_event(keywords, ev),
                        quote=cl.claim_text[:300],
                    )
                    session.add(evidence_cl)

    session.commit()
    logger.info(
        "EvidenceMap created for job %s: %d selected, %d omitted, %d gaps",
        job_target_id, len(selected), len(omitted), len(gaps),
    )
    return evidence_map


def _extract_keywords(session: Session, job: JobTarget) -> list[str]:
    """从 JD 文本 + JDAnalysis 提取关键词列表。"""
    words: list[str] = []

    # JD 原文中的中文关键词（按常见分隔符拆分）
    if job.raw_jd:
        # 提取技术栈、工具名等
        tech = re.findall(r'[A-Za-z+#.]+(?:[A-Za-z+#.0-9\s]*[A-Za-z+#.0-9])?', job.raw_jd)
        words.extend([t.strip().lower() for t in tech if len(t.strip()) > 1])

        # 提取中文关键词（引号内、括号内、书名号内）
        cn = re.findall(r'[「「【\[\(《（](.+?)[」」】\]\)》）]', job.raw_jd)
        words.extend([c.strip() for c in cn if len(c.strip()) > 1])

    # JDAnalysis 中的关键词
    jd_analysis = session.exec(
        select(JDAnalysis).where(JDAnalysis.job_target_id == job.id)
    ).first()
    if jd_analysis:
        for kw in (jd_analysis.keywords_json or []):
            words.append(kw.strip().lower())
        for req in (jd_analysis.must_have_json or []):
            words.append(req.strip().lower())
        for nice in (jd_analysis.nice_to_have_json or []):
            words.append(nice.strip().lower())

    # 去重 + 清理
    seen = set()
    result = []
    for w in words:
        if w and w not in seen and len(w) >= 2:
            seen.add(w)
            result.append(w)
    return result


def _score_event(keywords: list[str], event: CareerEvent) -> float:
    """为事件打匹配分（0-1）。综合考虑 title, description, tags, role。"""
    if not keywords:
        return 0.0

    text = " ".join([
        event.title or "",
        event.description or "",
        event.role or "",
        event.organization or "",
        " ".join(event.tags or []),
    ]).lower()

    hits = 0
    total = len(keywords)
    for kw in keywords:
        if kw.lower() in text:
            hits += 1

    return hits / max(total, 1)


def _detect_gaps(keywords: list[str], selected_events: list[CareerEvent]) -> dict:
    """检测哪些 keywords 没有被任何 selected event 匹配。"""
    matched_text = " ".join([
        e.title or "",
        e.description or "",
        e.role or "",
        " ".join(e.tags or []),
    ] for e in selected_events).lower()

    gaps = {}
    for kw in keywords:
        if kw.lower() not in matched_text:
            gaps[kw] = "not_covered"
    return gaps


def _build_rationale(keywords: list[str], selected_events: list[CareerEvent]) -> str:
    """生成映射理由简述。"""
    top_keywords = keywords[:10] if len(keywords) > 10 else keywords
    return (
        f"基于 {len(keywords)} 个关键词对 {len(selected_events)} 个经历事件的匹配结果。"
        f"核心关键词：{', '.join(top_keywords[:5])}。"
    )


def _create_empty_map(session: Session, job_target_id: str) -> EvidenceMap:
    """当用户没有任何事件时，创建一个空的 EvidenceMap。"""
    em = EvidenceMap(
        job_target_id=job_target_id,
        selected_event_ids=[],
        omitted_event_ids=[],
        gaps_json={"all": "no_events"},
        rationale="用户尚未添加任何职业经历事件。",
    )
    session.add(em)
    session.commit()
    return em
