'use client'

import { useState } from 'react'

const DOC_TYPES = [
  { id: 'resume', label: 'Resume', sub: '1-page tailored', active: true },
  { id: 'cover', label: 'Cover Letter', sub: '', active: false },
  { id: 'boss', label: 'Boss Opening', sub: '', active: false },
  { id: 'referral', label: 'Referral Q&A', sub: '', active: false },
]

const SECTIONS = [
  { id: 'contact', label: 'Contact', checked: true },
  { id: 'summary', label: 'Summary', checked: true },
  { id: 'experience', label: 'Work Experience', checked: true },
  { id: 'projects', label: 'Projects', checked: true },
  { id: 'skills', label: 'Skills', checked: true },
  { id: 'courses', label: 'Courses', checked: false },
  { id: 'awards', label: 'Awards', checked: false },
]

const PLAN_STEPS = [
  { label: '1. Positioning', desc: 'Agent infrastructure engineer', active: true },
  { label: '2. Evidence', desc: '3 events selected', active: true },
  { label: '3. Draft', desc: 'Not generated', active: false },
  { label: '4. Edit', desc: 'Editor', active: false },
  { label: '5. Export', desc: 'PDF verified', active: false },
]

const EVENT_PLAN = [
  { section: 'Experience', event: 'PM Agent', use: 'Lead with tool orchestration' },
  { section: 'Experience', event: 'Storage optimization', use: 'Service and production delivery' },
  { section: 'Projects', event: 'Career Vault Skill', use: 'Memory, schema, evidence model' },
]

export default function GeneratePage() {
  const [docType, setDocType] = useState('resume')
  const [target, setTarget] = useState('deepseek')
  const [language, setLanguage] = useState('chinese')
  const [template, setTemplate] = useState('ats')
  const [strictness, setStrictness] = useState('confirmed')
  const [checked, setChecked] = useState(SECTIONS.filter(s => s.checked).map(s => s.id))

  const toggle = (id: string) => {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">生成</h1>
          <p className="text-[13px] text-app-muted mt-1.5">Generate from an approved plan, not from a blind prompt.</p>
        </div>
        <button className="btn primary">Generate resume</button>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-4 items-start">
        {/* Left column */}
        <div className="space-y-3">
          {/* Document type */}
          <div className="bg-white border border-app-line rounded-lg">
            <div className="px-4 py-3.5 border-b border-app-line">
              <h2 className="text-[17px] font-semibold">Document type</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {DOC_TYPES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDocType(d.id)}
                  className={'h-16 border rounded-md flex flex-col items-center justify-center font-semibold text-sm transition-all ' +
                    (docType === d.id ? 'bg-app-blue text-white border-app-blue' : 'bg-white border-app-line text-app-ink hover:border-app-blue')}
                >
                  {d.label}
                  {d.sub && <span className="text-[11px] font-normal opacity-70">{d.sub}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white border border-app-line rounded-lg">
            <div className="px-4 py-3.5 border-b border-app-line">
              <h2 className="text-[17px] font-semibold">Controls</h2>
            </div>
            <div className="p-4 space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">Target</span>
                <select value={target} onChange={e => setTarget(e.target.value)} className="input h-[34px] text-sm">
                  <option value="deepseek">DeepSeek Harness Team</option>
                  <option value="kuaishou">Kuaishou AI</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">Language</span>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="input h-[34px] text-sm">
                  <option value="chinese">Chinese resume</option>
                  <option value="english">English resume</option>
                  <option value="bilingual">Bilingual</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">Template</span>
                <select value={template} onChange={e => setTemplate(e.target.value)} className="input h-[34px] text-sm">
                  <option value="ats">ATS Classic</option>
                  <option value="modern">Engineer Modern</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-app-muted font-semibold">Evidence strictness</span>
                <select value={strictness} onChange={e => setStrictness(e.target.value)} className="input h-[34px] text-sm">
                  <option value="confirmed">Confirmed only</option>
                  <option value="allow_weak">Allow reviewed weak claims</option>
                </select>
              </label>
            </div>
          </div>

          {/* Sections */}
          <div className="bg-white border border-app-line rounded-lg">
            <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Sections</h2>
              <span className="badge-blue">1-3 YoE preset</span>
            </div>
            <div className="p-4 space-y-2.5">
              {SECTIONS.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={checked.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="w-4 h-4 rounded border-app-line accent-app-blue"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Resume plan preview */}
        <div className="bg-white border border-app-line rounded-lg">
          <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">Resume plan preview</h2>
            <span className="badge-amber">Approval required</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Flow steps */}
            <div className="flex gap-1.5">
              {PLAN_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex-1 p-2.5 rounded-md text-center border transition-colors ${
                    step.active ? 'bg-[#f0f5ff] border-app-blue/40' : 'bg-[#fbfcfe] border-app-line-soft opacity-50'
                  }`}
                >
                  <h3 className="text-xs font-extrabold">{step.label}</h3>
                  <p className="text-[11px] text-app-muted mt-0.5">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Positioning */}
            <div className="p-3.5 rounded-md bg-app-panel-soft border border-app-line-soft">
              <h3 className="text-sm font-semibold">Positioning</h3>
              <p className="text-sm mt-2">Position Peifeng as an early-career Agent infrastructure engineer with hands-on tool orchestration, context management, service integration, and safety boundary experience.</p>
            </div>

            {/* Selected + Risks */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-md bg-white border border-app-line-soft">
                <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Selected sections</h3>
                <div className="flex gap-1.5 flex-wrap">
                  {checked.map(id => {
                    const sec = SECTIONS.find(s => s.id === id)
                    return sec ? <span key={id} className="badge-blue">{sec.label}</span> : null
                  })}
                </div>
              </div>
              <div className="p-3.5 rounded-md bg-white border border-app-line-soft">
                <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Risks</h3>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="badge-amber">Agent evaluation weak</span>
                  <span className="badge-amber">Page budget tight</span>
                </div>
              </div>
            </div>

            {/* Events table */}
            <div className="p-3.5 rounded-md bg-white border border-app-line-soft">
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-2">Events to use</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-line-soft">
                    <th className="text-left py-2 text-xs text-app-muted font-extrabold uppercase">Section</th>
                    <th className="text-left py-2 text-xs text-app-muted font-extrabold uppercase">Event</th>
                    <th className="text-left py-2 text-xs text-app-muted font-extrabold uppercase">Use</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENT_PLAN.map((row, i) => (
                    <tr key={i} className="border-b border-app-line-soft last:border-0">
                      <td className="py-2 pr-3 text-sm">{row.section}</td>
                      <td className="py-2 pr-3 text-sm font-semibold">{row.event}</td>
                      <td className="py-2 text-sm text-app-muted">{row.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button className="btn">Adjust evidence</button>
              <button className="btn primary">Approve plan and generate</button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .btn { height: 36px; border: 1px solid #d9dee7; background: #fff; color: #172033; padding: 0 12px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-weight: 650; cursor: pointer; white-space: nowrap; font-size: 14px; }
        .btn.primary { background: #1f5eff; color: #fff; border-color: #1f5eff; }
        .btn:hover { opacity: 0.9; }
        .input { border: 1px solid #d9dee7; border-radius: 7px; background: #fff; color: #172033; padding: 8px 11px; font-size: 14px; width: 100%; }
        .input:focus { outline: none; border-color: #1f5eff; }
        .badge-amber { background: #fff2dc; color: #b97913; border: 1px solid #ffe1ad; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge-blue { background: #eaf0ff; color: #1741a6; border: 1px solid #d8e3ff; display: inline-flex; align-items: center; gap: 5px; height: 23px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
      `}</style>
    </div>
  )
}
