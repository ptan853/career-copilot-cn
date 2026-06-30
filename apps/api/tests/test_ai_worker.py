from sqlmodel import Session, SQLModel, create_engine, select

import services.ai_worker as ai_worker
from models import BackgroundJob, CareerEvent, Claim, Evidence, SourceMaterial, User
from services.llm_providers import LLMGenerateResult, ProviderConfig, ProviderError, ProviderKind


def test_execute_job_persists_events_claims_evidence_and_metadata(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'worker.db'}", echo=False)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(ai_worker, "engine", engine)

    with Session(engine) as session:
        user = User(email="worker@example.com", display_name="Worker User")
        session.add(user)
        session.commit()
        session.refresh(user)

        source = SourceMaterial(
            user_id=user.id,
            source_type="text",
            title="简历片段",
            raw_text="负责增长实验设计",
            parse_status="uploaded",
        )
        session.add(source)
        session.commit()
        session.refresh(source)

        job = BackgroundJob(
            user_id=user.id,
            job_type="source_parse",
            payload={"source_id": str(source.id), "text": source.raw_text},
            status="queued",
        )
        session.add(job)
        session.commit()
        session.refresh(job)

        monkeypatch.setattr(ai_worker, "DRY_RUN", False)
        monkeypatch.setattr(
            ai_worker,
            "resolve_provider_config",
            lambda user_id, session: ProviderConfig(
                kind=ProviderKind.BAILIAN_QWEN,
                name="bailian-qwen-plus",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                api_key="sk-test",
                model_name="qwen-plus",
            ),
        )

        class FakeProvider:
            def __init__(self, config):
                self.config = config

            def generate(self, request):
                assert request.response_format == "json"
                return LLMGenerateResult(
                    provider=self.config.name,
                    model=self.config.model_name,
                    text="{}",
                    json_data={
                        "source_type": "resume",
                        "source_subtype": "resume",
                        "language": "zh-CN",
                        "sections": [
                            {
                                "section_type": "work",
                                "section_title": "工作经历",
                                "events": [
                                    {
                                        "event_type": "internship",
                                        "title": "增长产品实习",
                                        "role": "产品实习生",
                                        "organization": "字节跳动",
                                        "time_start": "2024-06",
                                        "time_end": "2025-03",
                                        "details": {"context": "增长场景", "needs_review_fields": ["outcome"]},
                                        "claims": [
                                            {
                                                "claim_text": "参与增长实验设计。",
                                                "claim_type": "responsibility",
                                                "strength": "confirmed",
                                                "evidence_quote": "负责增长实验设计",
                                                "confidence": 0.84,
                                            }
                                        ],
                                        "evidence": [
                                            {"quote": "负责增长实验设计", "locator": {"page": 1}, "confidence": 0.84}
                                        ],
                                        "confidence": 0.84,
                                    }
                                ],
                            }
                        ],
                        "warnings": ["部分指标缺少原文证据。"],
                    },
                )

        monkeypatch.setattr(ai_worker, "OpenAICompatibleProvider", FakeProvider)

        ai_worker._execute_job(session, job)

        session.refresh(source)
        session.refresh(job)
        event = session.exec(select(CareerEvent).where(CareerEvent.source_id == source.id)).one()
        claim = session.exec(select(Claim).where(Claim.career_event_id == event.id)).one()
        event_evidence = session.exec(
            select(Evidence).where(
                Evidence.career_event_id == event.id,
                Evidence.claim_id.is_(None),
            )
        ).one()
        claim_evidence = session.exec(select(Evidence).where(Evidence.claim_id == claim.id)).one()

        assert source.parse_status == "parsed"
        assert source.metadata_json["source_subtype"] == "resume"
        assert source.metadata_json["ai_warnings"] == ["部分指标缺少原文证据。"]
        assert source.metadata_json["parse_provider"] == "bailian-qwen-plus"
        assert source.metadata_json["parse_model"] == "qwen-plus"
        assert job.status == "succeeded"
        assert event.status == "draft"
        assert event.details_json["context"] == "增长场景"
        assert event.details_json["needs_review_fields"] == ["outcome"]
        assert event.details_json["section_type"] == "work"
        assert claim.claim_text == "参与增长实验设计。"
        assert event_evidence.quote == "负责增长实验设计"
        assert event_evidence.locator_json == {"page": 1}
        assert claim_evidence.quote == "负责增长实验设计"
        assert claim_evidence.locator_json == {}


def test_execute_job_marks_source_failed_when_provider_fails(monkeypatch, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'worker-failure.db'}", echo=False)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(ai_worker, "engine", engine)

    with Session(engine) as session:
        user = User(email="worker-failure@example.com", display_name="Worker Failure")
        session.add(user)
        session.commit()
        session.refresh(user)

        source = SourceMaterial(
            user_id=user.id,
            source_type="text",
            title="简历片段",
            raw_text="负责增长实验设计",
            parse_status="uploaded",
        )
        session.add(source)
        session.commit()
        session.refresh(source)

        job = BackgroundJob(
            user_id=user.id,
            job_type="source_parse",
            payload={"source_id": str(source.id), "text": source.raw_text},
            status="queued",
        )
        session.add(job)
        session.commit()
        session.refresh(job)

        monkeypatch.setattr(ai_worker, "DRY_RUN", False)
        monkeypatch.setattr(
            ai_worker,
            "resolve_provider_config",
            lambda user_id, session: ProviderConfig(
                kind=ProviderKind.BAILIAN_QWEN,
                name="bailian-qwen-plus",
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
                api_key="sk-test",
                model_name="qwen-plus",
            ),
        )

        class FailingProvider:
            def __init__(self, config):
                self.config = config

            def generate(self, request):
                raise ProviderError(self.config.name, "quota exceeded", 429)

        monkeypatch.setattr(ai_worker, "OpenAICompatibleProvider", FailingProvider)

        ai_worker._execute_job(session, job)

        session.refresh(source)
        session.refresh(job)

        assert source.parse_status == "failed"
        assert source.parse_error == "quota exceeded"
        assert job.status == "failed"
        assert job.error_message == "quota exceeded"
