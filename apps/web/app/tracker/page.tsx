'use client'

import { useState } from 'react'

const STAGES = ['待投递', '已投递', '面试中', 'Offer/结束']

const APPLICATIONS = [
  { id: 'a1', title: 'Agent Harness Engineer', company: 'DeepSeek Harness Team', stage: '待投递', priority: 'high', date: 'Due Jul 12', notes: 'Resume plan approved, evidence map done' },
  { id: 'a2', title: 'Senior Agent Platform Engineer', company: 'Kuaishou AI', stage: '已投递', priority: 'medium', date: 'Applied Jun 25', notes: 'Resume sent via referral' },
  { id: 'a3', title: 'ML Evaluation Engineer', company: 'ByteDance', stage: '面试中', priority: 'medium', date: 'Phone screen Jul 2', notes: 'Tech round scheduled' },
  { id: 'a4', title: 'AI Platform Engineer Intern', company: 'SenseTime', stage: 'Offer/结束', priority: 'low', date: 'Ended Jun 15', notes: 'Accepted another offer' },
]

const PRIORITY_CONFIG: Record<string, string> = {
  high: 'badge-red',
  medium: 'badge-amber',
  low: 'badge-gray',
}

export default function TrackerPage() {
  const [apps] = useState(APPLICATIONS)

  const stageGroups = STAGES.reduce((acc: Record<string, typeof APPLICATIONS>, stage) => {
    acc[stage] = apps.filter(a => a.stage === stage)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">投递追踪</h1>
          <p className="text-[13px] text-app-muted mt-1.5">Kanban view of your application pipeline.</p>
        </div>
        <button className="btn primary">添加投递</button>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-4 gap-3 items-start">
        {STAGES.map(stage => (
          <div key={stage} className="bg-[#eef2f7] rounded-lg p-3 min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-extrabold text-app-muted uppercase tracking-wider">{stage}</h2>
              <span className="badge-gray text-[11px]">{stageGroups[stage].length}</span>
            </div>
            <div className="space-y-2.5">
              {stageGroups[stage].map(app => (
                <div key={app.id} className="bg-white border border-app-line-soft rounded-md p-3 hover:border-app-blue/40 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold leading-tight">{app.title}</h3>
                    <span className={PRIORITY_CONFIG[app.priority]}>{app.priority}</span>
                  </div>
                  <p className="text-xs text-app-muted">{app.company}</p>
                  <p className="text-[11px] text-app-muted mt-1">{app.date}</p>
                  {app.notes && (
                    <p className="text-[11px] text-app-muted mt-1 italic">{app.notes}</p>
                  )}
                </div>
              ))}
              {stageGroups[stage].length === 0 && (
                <p className="text-[11px] text-app-muted text-center py-6">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .badge-red { background: #fdecec; color: #bd3b3b; border: 1px solid #f6cfcf; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-amber { background: #fff2dc; color: #b97913; border: 1px solid #ffe1ad; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-gray { background: #f1f3f6; color: #5f6b7c; border: 1px solid #e2e6ec; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
      `}</style>
    </div>
  )
}
