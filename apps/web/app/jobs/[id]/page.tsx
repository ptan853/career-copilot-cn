'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const DEMO_JOB = {
  id: 'deepseek-harness',
  title: 'Agent Harness Engineer',
  company: 'DeepSeek Harness Team',
  location: 'Shenzhen / Remote',
  source: 'Company career site',
  priority: 'high',
  deadline: 'Jul 12',
  match_score: 86,
  raw_jd: '加入 DeepSeek Harness 团队，探索 Agent Harness 方向的未知前沿。关注 Agent loop、tool use、reasoning、planning、skills、memory、evaluation、safety guardrails。设计并实现通用的 Agent 框架，支持多模型切换、工具编排、沙箱执行和可观测性。要求：3-5 年工程经验，熟悉 Python/Go，有 LLM/Agent 相关项目经验。加分项：开源贡献、论文发表、性能基准评测经验。',
  ai_analysis: {
    must_have: ['Agent loop', 'Tool use', 'Evaluation'],
    nice_to_have: ['Sandboxing', 'Benchmark', 'Memory'],
    recommended_narrative: 'Position as an Agent infrastructure engineer with practical tool orchestration and safety experience.',
  },
  evidence_gaps: [
    { label: 'Strong: Tool orchestration', desc: 'PM Agent + LangGraph migration', strength: 'strong' },
    { label: 'Strong: Safety boundary', desc: 'Command sandbox project', strength: 'strong' },
    { label: 'Weak: Agent evaluation', desc: 'Needs stronger evidence', strength: 'weak' },
  ],
}

export default function JobDetailPage() {
  const params = useParams()
  const job = DEMO_JOB // In real app, fetch by params.id

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">岗位详情</h1>
          <p className="text-[13px] text-app-muted mt-1.5">A role-specific workspace before any document is generated.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn">Archive</button>
          <button className="btn primary">Generate materials</button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white border border-app-line rounded-lg p-4 mb-4">
        <div className="flex justify-between gap-5">
          <div>
            <span className="badge-blue">Machine Learning</span>
            <h2 className="text-[22px] font-bold mt-2">{job.company} · {job.title}</h2>
            <p className="text-[13px] text-app-muted mt-1.5">{job.source} · {job.location} · Priority {job.priority} · Deadline {job.deadline}</p>
          </div>
          <div className="text-right">
            <p className="text-[34px] font-extrabold text-app-green leading-none">{job.match_score}</p>
            <p className="text-xs text-app-muted mt-1">Match score</p>
          </div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-4 items-start">
        {/* Raw JD */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Raw JD</h2>
            <span className="badge-gray">Captured URL</span>
          </div>
          <div className="p-4">
            <p className="text-sm leading-relaxed text-app-ink">{job.raw_jd}</p>
            <div className="h-px bg-app-line-soft my-3.5" />
            <button className="btn w-full text-xs">Open original source</button>
          </div>
        </div>

        {/* AI analysis */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">AI analysis</h2>
            <span className="badge-cyan">Target profile</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Must have</h3>
              <div className="flex gap-1.5 flex-wrap">
                {job.ai_analysis.must_have.map(t => <span key={t} className="badge-blue">{t}</span>)}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Nice to have</h3>
              <div className="flex gap-1.5 flex-wrap">
                {job.ai_analysis.nice_to_have.map(t => <span key={t} className="badge-gray">{t}</span>)}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Recommended narrative</h3>
              <p className="text-sm mt-1">{job.ai_analysis.recommended_narrative}</p>
            </div>
          </div>
        </div>

        {/* Evidence gaps */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line">
            <h2 className="text-[17px] font-semibold">Evidence gaps</h2>
          </div>
          <div className="p-4 space-y-3">
            {job.evidence_gaps.map((gap, i) => (
              <div key={i} className="flex gap-3 p-3 border border-app-line-soft rounded-md">
                <div className={`source-dot ${gap.strength === 'strong' ? 'confirmed' : 'warning'}`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{gap.label}</h3>
                  <p className="text-xs text-app-muted">{gap.desc}</p>
                </div>
              </div>
            ))}
            <Link href="/evidence" className="btn primary w-full text-xs inline-flex">Open evidence map</Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .badge-gray { background: #f1f3f6; color: #5f6b7c; border: 1px solid #e2e6ec; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-blue { background: #eaf0ff; color: #1741a6; border: 1px solid #d8e3ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-cyan { background: #e6f5f5; color: #0f8b8d; border: 1px solid #c8e8e9; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .source-dot { width: 26px; height: 26px; border-radius: 6px; background: #eef2f8; border: 1px solid #d9dee7; color: #526176; display: grid; place-items: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; font-size: 11px; flex-shrink: 0; }
        .source-dot.confirmed { background: #e7f6ef; border-color: #cceada; color: #16805d; }
        .source-dot.warning { background: #fff2dc; border-color: #ffe1ad; color: #b97913; }
      `}</style>
    </div>
  )
}
