'use client'

import { useState } from 'react'
import Link from 'next/link'

const DEMO_MATRIX = [
  {
    id: 'r1',
    requirement: 'Build agent harness around tool use, reasoning, memory',
    note: 'Core requirement',
    evidence: [
      { label: 'PM Agent', cls: 'badge-green' },
      { label: 'LangGraph', cls: 'badge-blue' },
    ],
    evidence_note: 'Confirmed events S1, S2',
    gap: 'Strong',
    gap_cls: 'badge-green',
    gap_note: 'Use as lead section.',
  },
  {
    id: 'r2',
    requirement: 'Evaluate agent behavior and failure modes',
    note: 'Important but less explicit',
    evidence: [
      { label: 'Agent sandbox', cls: 'badge-amber' },
      { label: 'Benchmark notes', cls: 'badge-gray' },
    ],
    evidence_note: 'Partial evidence',
    gap: 'Weak',
    gap_cls: 'badge-amber',
    gap_note: 'Ask user for evaluation examples.',
  },
  {
    id: 'r3',
    requirement: 'Production engineering and service integration',
    note: 'Delivery signal',
    evidence: [
      { label: 'FastAPI service', cls: 'badge-green' },
      { label: 'ToolManager', cls: 'badge-green' },
    ],
    evidence_note: 'Confirmed events S3, S4',
    gap: 'Strong',
    gap_cls: 'badge-green',
    gap_note: 'Good for experience bullets.',
  },
  {
    id: 'r4',
    requirement: 'Open-source contributions or publications',
    note: 'Nice to have',
    evidence: [
      { label: 'LangGraph PRs', cls: 'badge-blue' },
    ],
    evidence_note: 'Moderate evidence',
    gap: 'Moderate',
    gap_cls: 'badge-blue',
    gap_note: 'Add contribution links.',
  },
]

export default function EvidenceMapPage() {
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(['s1', 's2', 's3', 's4']))
  const [omittedEvents, setOmittedEvents] = useState<Set<string>>(new Set(['s5', 's6']))

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">证据映射</h1>
          <p className="text-[13px] text-app-muted mt-1.5">Target-first selection: choose evidence before generating the resume.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn">Regenerate map</button>
          <button className="btn primary">Approve map</button>
        </div>
      </div>

      {/* Target selector */}
      <div className="bg-white border border-app-line rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-app-muted font-semibold">Target:</span>
            <select className="input w-auto min-w-[320px] text-sm h-[34px]">
              <option>DeepSeek Harness Team — Agent Harness Engineer</option>
              <option>Kuaishou AI — Senior Agent Platform Engineer</option>
            </select>
          </div>
          <div className="flex gap-6 text-sm">
            <div><span className="text-app-muted text-xs">Requirements</span><p className="font-extrabold">{DEMO_MATRIX.length}</p></div>
            <div><span className="text-app-muted text-xs">Selected events</span><p className="font-extrabold text-app-green">{selectedEvents.size}</p></div>
            <div><span className="text-app-muted text-xs">Omitted</span><p className="font-extrabold text-app-muted">{omittedEvents.size}</p></div>
          </div>
        </div>
      </div>

      {/* Evidence matrix */}
      <div className="bg-white border border-app-line rounded-lg overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_1.2fr_180px] border-b border-app-line bg-[#f9fafc] text-xs font-extrabold text-app-muted uppercase tracking-wider">
          <div className="px-4 py-3">JD requirement</div>
          <div className="px-4 py-3 border-l border-app-line">Selected evidence</div>
          <div className="px-4 py-3 border-l border-app-line">Gap / risk</div>
        </div>
        {DEMO_MATRIX.map(row => (
          <div key={row.id} className="grid grid-cols-[1fr_1.2fr_180px] border-b border-app-line-soft">
            <div className="px-4 py-3.5">
              <p className="text-sm font-semibold">{row.requirement}</p>
              <p className="text-xs text-app-muted mt-0.5">{row.note}</p>
            </div>
            <div className="px-4 py-3.5 border-l border-app-line-soft">
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {row.evidence.map((e, i) => (
                  <span key={i} className={e.cls}>{e.label}</span>
                ))}
              </div>
              <p className="text-xs text-app-muted">{row.evidence_note}</p>
            </div>
            <div className="px-4 py-3.5 border-l border-app-line-soft">
              <span className={row.gap_cls}>{row.gap}</span>
              <p className="text-xs text-app-muted mt-1.5">{row.gap_note}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Selected / Omitted event panels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Selected events</h2>
            <span className="badge-green">{selectedEvents.size} events</span>
          </div>
          <div className="p-4 space-y-3">
            {[...selectedEvents].map(id => (
              <div key={id} className="flex gap-3 items-center">
                <div className="source-dot confirmed">{id.toUpperCase()}</div>
                <div>
                  <p className="text-sm font-semibold">Event title placeholder</p>
                  <p className="text-xs text-app-muted">Confirmed · Work</p>
                </div>
              </div>
            ))}
            {selectedEvents.size === 0 && <p className="text-xs text-app-muted">No events selected yet</p>}
          </div>
        </div>
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Omitted events</h2>
            <span className="badge-gray">{omittedEvents.size} events</span>
          </div>
          <div className="p-4 space-y-3">
            {[...omittedEvents].map(id => (
              <div key={id} className="flex gap-3 items-center">
                <div className="source-dot">{id.toUpperCase()}</div>
                <div>
                  <p className="text-sm font-semibold">Event title placeholder</p>
                  <p className="text-xs text-app-muted">Not selected for this target</p>
                </div>
              </div>
            ))}
            {omittedEvents.size === 0 && <p className="text-xs text-app-muted">No omitted events</p>}
          </div>
        </div>
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .input { border: 1px solid #d9dee7; border-radius: 7px; background: #fff; color: #172033; padding: 8px 11px; font-size: 14px; }
        .input:focus { outline: none; border-color: #1f5eff; }
        .badge-green { background: #e7f6ef; color: #16805d; border: 1px solid #cceada; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-amber { background: #fff2dc; color: #b97913; border: 1px solid #ffe1ad; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-blue { background: #eaf0ff; color: #1741a6; border: 1px solid #d8e3ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-gray { background: #f1f3f6; color: #5f6b7c; border: 1px solid #e2e6ec; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .source-dot { width: 26px; height: 26px; border-radius: 6px; background: #eef2f8; border: 1px solid #d9dee7; color: #526176; display: grid; place-items: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; font-size: 11px; flex-shrink: 0; }
        .source-dot.confirmed { background: #e7f6ef; border-color: #cceada; color: #16805d; }
      `}</style>
    </div>
  )
}
