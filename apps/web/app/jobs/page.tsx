'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getDashboardSummary } from '@/lib/api-client'

const DEMO_JOBS = [
  {
    id: 'deepseek-harness',
    title: 'Agent Harness Engineer',
    company: 'DeepSeek Harness Team',
    location: 'Shenzhen / Remote',
    source: 'Company career site',
    priority: 'high',
    deadline: '2026-07-12',
    match_score: 86,
    status: 'analyzing',
  },
  {
    id: 'kuaishou-agent',
    title: 'Senior Agent Platform Engineer',
    company: 'Kuaishou AI',
    location: 'Beijing',
    source: 'Referral',
    priority: 'medium',
    deadline: '2026-07-25',
    match_score: 72,
    status: 'applied',
  },
  {
    id: 'bytedance-eval',
    title: 'ML Evaluation Engineer',
    company: 'ByteDance',
    location: 'Shanghai',
    source: 'LinkedIn',
    priority: 'low',
    deadline: '2026-08-10',
    match_score: 64,
    status: 'draft',
  },
]

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  high:   { label: '高优先', cls: 'badge-red' },
  medium: { label: '中优先', cls: 'badge-amber' },
  low:    { label: '低优先', cls: 'badge-gray' },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: '草稿', cls: 'badge-gray' },
  analyzing: { label: '分析中', cls: 'badge-blue' },
  ready:     { label: '就绪', cls: 'badge-green' },
  applied:   { label: '已投递', cls: 'badge-cyan' },
}

export default function JobsPage() {
  const [jobs] = useState(DEMO_JOBS)

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">岗位库</h1>
          <p className="text-[13px] text-app-muted mt-1.5">管理你的目标岗位。为每个岗位分析 JD、映射证据、生成定向材料。</p>
        </div>
        <button className="btn primary">添加岗位</button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {jobs.map(job => {
          const priority = PRIORITY_CONFIG[job.priority] || PRIORITY_CONFIG.low
          const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft
          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="bg-white border border-app-line rounded-lg p-4 flex items-center justify-between gap-6 hover:border-app-blue/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-[#eef2f8] border border-app-line grid place-items-center text-app-blue font-extrabold text-lg shrink-0">
                  {job.company[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{job.title}</h2>
                  <p className="text-xs text-app-muted mt-0.5">{job.company} · {job.location}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="text-[11px] text-app-muted">{job.source}</span>
                    <span className="text-[11px] text-app-muted">·</span>
                    <span className="text-[11px] text-app-muted">Deadline {job.deadline}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={priority.cls}>{priority.label}</span>
                {job.match_score > 0 && (
                  <span className="text-lg font-extrabold text-app-green">{job.match_score}</span>
                )}
                <span className={status.cls}>{status.label}</span>
              </div>
            </Link>
          )
        })}
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .badge-amber { background: #fff2dc; color: #b97913; border: 1px solid #ffe1ad; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-green { background: #e7f6ef; color: #16805d; border: 1px solid #cceada; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-red { background: #fdecec; color: #bd3b3b; border: 1px solid #f6cfcf; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-gray { background: #f1f3f6; color: #5f6b7c; border: 1px solid #e2e6ec; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-blue { background: #eaf0ff; color: #1741a6; border: 1px solid #d8e3ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-cyan { background: #e6f5f5; color: #0f8b8d; border: 1px solid #c8e8e9; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
      `}</style>
    </div>
  )
}
