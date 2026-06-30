'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getJobs, getEvidenceMap, createEvidenceMap, getEvents } from '@/lib/api-client'

const EVENT_TYPE_CONFIG: Record<string, string> = {
  work: '工作', internship: '实习', project: '项目', education: '教育',
  certification: '证书', award: '获奖', publication: '发表', patent: '专利',
  course: '课程', competition: '竞赛', open_source: '开源', startup: '创业',
  volunteer: '志愿', language: '语言', custom: '其他',
}

const STRENGTH_CONFIG: Record<string, { label: string; cls: string }> = {
  Strong:   { label: '强匹配', cls: 'badge-green' },
  Moderate: { label: '中等', cls: 'badge-blue' },
  Weak:     { label: '薄弱', cls: 'badge-amber' },
  Gap:      { label: '缺口', cls: 'badge-red' },
}

export default function EvidenceMapPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [evidenceMap, setEvidenceMap] = useState<any>(null)
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mapping, setMapping] = useState(false)

  // Load job list
  useEffect(() => {
    getJobs().then((r: any) => setJobs(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Load all events for lookup
  useEffect(() => {
    getEvents().then((r: any) => setAllEvents(r.data || [])).catch(() => {})
  }, [])

  // Load evidence map when job changes
  const loadEvidenceMap = useCallback(async (jobId: string) => {
    if (!jobId) return
    try {
      const res: any = await getEvidenceMap(jobId)
      setEvidenceMap(res.data)
    } catch { setEvidenceMap(null) }
  }, [])

  useEffect(() => {
    if (selectedJobId) loadEvidenceMap(selectedJobId)
  }, [selectedJobId, loadEvidenceMap])

  const handleMap = async () => {
    if (!selectedJobId) return
    setMapping(true)
    try {
      const res: any = await createEvidenceMap(selectedJobId)
      setEvidenceMap(res.data)
    } catch {} finally { setMapping(false) }
  }

  const eventById = (id: string) => allEvents.find(e => e.id === id)

  // Build requirement rows from JD analysis keywords
  const requirements = evidenceMap?.gaps
    ? Object.entries(evidenceMap.gaps).map(([kw, status]) => ({
        requirement: kw,
        matched: status !== 'not_covered',
      }))
    : []

  const selectedEvents = (evidenceMap?.selected_events || evidenceMap?.selected_event_ids || []).map((e: any) =>
    typeof e === 'string' ? eventById(e) || { id: e, title: '加载中...' } : e
  )

  const omittedEvents = (evidenceMap?.omitted_events || evidenceMap?.omitted_event_ids || []).map((e: any) =>
    typeof e === 'string' ? eventById(e) || { id: e, title: '加载中...' } : e
  )

  const selectedJob = jobs.find(j => j.id === selectedJobId)

  return (
    <div>
      <div className="flex items-start justify-between gap-5 mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-normal leading-tight">证据映射</h1>
          <p className="text-[13px] text-app-muted mt-1.5">按岗位要求匹配你的经历，标注匹配证据和缺口。</p>
        </div>
        <div className="flex gap-2">
          {evidenceMap && (
            <button className="btn" onClick={handleMap} disabled={mapping}>
              {mapping ? '映射中...' : '重新映射'}
            </button>
          )}
          <Link href="/vault" className="btn">补充资料库</Link>
        </div>
      </div>

      {/* Job selector */}
      <div className="app-card p-4 mb-4">
        <div className="flex items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-app-muted font-semibold">目标岗位：</span>
            {loading ? (
              <p className="text-xs text-app-muted">加载岗位列表...</p>
            ) : jobs.length === 0 ? (
              <div>
                <p className="text-xs text-app-muted">还没有岗位。</p>
                <Link href="/jobs" className="btn primary text-xs mt-1 inline-flex">添加岗位</Link>
              </div>
            ) : (
              <select
                className="input w-auto min-w-[320px] text-sm h-[34px]"
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
              >
                <option value="">选择岗位...</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {[j.company, j.role].filter(Boolean).join(' · ') || '未命名岗位'}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedJobId && !evidenceMap && (
            <button className="btn primary" onClick={handleMap} disabled={mapping}>
              {mapping ? '映射中...' : '执行证据映射'}
            </button>
          )}
          {evidenceMap && (
            <div className="flex gap-6 text-sm">
              <div><span className="text-app-muted text-xs">选中事件</span><p className="font-extrabold text-app-green">{evidenceMap.selected_event_ids?.length || 0}</p></div>
              <div><span className="text-app-muted text-xs">已忽略</span><p className="font-extrabold text-app-muted">{evidenceMap.omitted_event_ids?.length || 0}</p></div>
              <div><span className="text-app-muted text-xs">缺口</span><p className="font-extrabold text-app-amber">{Object.keys(evidenceMap.gaps || {}).length}</p></div>
            </div>
          )}
        </div>
      </div>

      {!selectedJobId && !loading && (
        <div className="app-card p-10 text-center">
          <p className="text-lg font-black">选择一个目标岗位</p>
          <p className="text-xs text-app-muted mt-2">选择你追踪的岗位后，系统会自动匹配你的经历与 JD 要求。</p>
        </div>
      )}

      {selectedJobId && !evidenceMap && !mapping && (
        <div className="app-card p-10 text-center">
          <p className="text-lg font-black">尚未映射证据</p>
          <p className="text-xs text-app-muted mt-2">点击"执行证据映射"，系统会基于关键词匹配你的经历事件。</p>
        </div>
      )}

      {evidenceMap && (
        <>
          {/* Evidence matrix */}
          <div className="app-card overflow-hidden mb-4">
            <div className="grid grid-cols-[1fr_1.2fr_180px] border-b border-app-line bg-[#f9fafc] text-xs font-extrabold text-app-muted uppercase tracking-wider">
              <div className="px-4 py-3">JD 关键词 / 要求</div>
              <div className="px-4 py-3 border-l border-app-line">匹配证据</div>
              <div className="px-4 py-3 border-l border-app-line">匹配度</div>
            </div>
            {requirements.length > 0 ? requirements.map((row: any, ri: number) => {
              const matchingEvents = selectedEvents.filter((ev: any) => {
                const txt = [ev.title, ev.description, ev.organization, ev.role].filter(Boolean).join(' ').toLowerCase()
                return txt.includes(row.requirement.toLowerCase())
              })
              const strength = matchingEvents.length > 0 ? 'Strong' : 'Gap'
              const sc = STRENGTH_CONFIG[strength] || STRENGTH_CONFIG.Gap
              return (
                <div key={ri} className="grid grid-cols-[1fr_1.2fr_180px] border-b border-app-line-soft">
                  <div className="px-4 py-3.5">
                    <p className="text-sm font-semibold">{row.requirement}</p>
                  </div>
                  <div className="px-4 py-3.5 border-l border-app-line-soft">
                    {matchingEvents.length > 0 ? (
                      <div className="space-y-1">
                        {matchingEvents.map((ev: any) => (
                          <div key={ev.id} className="flex items-center gap-2">
                            <div className="source-dot confirmed" style={{ width: 18, height: 18, fontSize: 9 }}>✓</div>
                            <span className="text-sm">{ev.title}</span>
                            <span className="text-[10px] text-app-muted">{EVENT_TYPE_CONFIG[ev.event_type] || ev.event_type}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-app-muted">无匹配事件 — 建议补充经历或核实关键词</p>
                    )}
                  </div>
                  <div className="px-4 py-3.5 border-l border-app-line-soft">
                    <span className={sc.cls}>{sc.label}</span>
                  </div>
                </div>
              )
            }) : (
              <div className="px-4 py-8 text-center text-xs text-app-muted">
                没有从 JD 中提取到关键词。请确保岗位已包含完整的 JD 描述。
              </div>
            )}
          </div>

          {/* Selected / Omitted panels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="app-card">
              <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
                <h2 className="text-[17px] font-semibold">已选中事件</h2>
                <span className="badge-green">{selectedEvents.length} 条</span>
              </div>
              <div className="p-4 space-y-3">
                {selectedEvents.length > 0 ? selectedEvents.map((ev: any) => (
                  <div key={ev.id} className="flex gap-3 items-center">
                    <div className="source-dot confirmed">{(ev.event_type || '?')[0].toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-semibold">{ev.title}</p>
                      <p className="text-xs text-app-muted">
                        {[EVENT_TYPE_CONFIG[ev.event_type], ev.organization, ev.description?.slice(0, 80)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-app-muted">无匹配事件。请先在资料库中添加职业经历。</p>
                )}
              </div>
            </div>
            <div className="app-card">
              <div className="px-4 py-3.5 border-b border-app-line flex items-center justify-between">
                <h2 className="text-[17px] font-semibold">未选中事件</h2>
                <span className="badge-gray">{omittedEvents.length} 条</span>
              </div>
              <div className="p-4 space-y-3">
                {omittedEvents.length > 0 ? omittedEvents.map((ev: any) => (
                  <div key={ev.id} className="flex gap-3 items-center">
                    <div className="source-dot">{(ev.event_type || '?')[0].toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-semibold">{ev.title}</p>
                      <p className="text-xs text-app-muted">未匹配当前岗位要求</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-app-muted">所有事件均已匹配</p>
                )}
              </div>
            </div>
          </div>

          {evidenceMap.rationale && (
            <div className="app-card p-4 mt-4">
              <h3 className="text-xs font-extrabold text-app-muted uppercase tracking-wider mb-1">映射理由</h3>
              <p className="text-sm">{evidenceMap.rationale}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
