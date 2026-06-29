'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getEvents, createEvent, updateEvent, confirmEvent, archiveEvent,
  getSources, createSource, uploadSource as uploadSourceFile,
  getReadiness,
} from '@/lib/api-client'

// ─── Constants ────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<string, { label: string; bar: string; bg: string }> = {
  work:          { label: '工作', bar: '#24243f', bg: '#f4c4ca' },
  internship:    { label: '实习', bar: '#8e74ff', bg: '#ddd5ff' },
  project:       { label: '项目', bar: '#34a47f', bg: '#c5efdf' },
  education:     { label: '教育', bar: '#4a7dff', bg: '#dbe7ff' },
  certification: { label: '证书', bar: '#34a47f', bg: '#dff8f1' },
  award:         { label: '获奖', bar: '#c78733', bg: '#f8d7aa' },
  publication:   { label: '发表', bar: '#d95f67', bg: '#ffe3e6' },
  patent:        { label: '专利', bar: '#d95f67', bg: '#ffe3e6' },
  course:        { label: '课程', bar: '#4a7dff', bg: '#dbe7ff' },
  competition:   { label: '竞赛', bar: '#c78733', bg: '#f8d7aa' },
  open_source:   { label: '开源', bar: '#8e74ff', bg: '#ddd5ff' },
  startup:       { label: '创业', bar: '#d95f67', bg: '#ffe3e6' },
  volunteer:     { label: '志愿', bar: '#34a47f', bg: '#c5efdf' },
  language:      { label: '语言', bar: '#4a7dff', bg: '#dbe7ff' },
  custom:        { label: '其他', bar: '#6d7382', bg: '#f4f1ec' },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:        { label: '待审核', cls: 'badge-amber' },
  needs_review: { label: '需修改', cls: 'badge-red' },
  confirmed:    { label: '已确认', cls: 'badge-green' },
  archived:     { label: '已归档', cls: 'badge-gray' },
}

const EVENT_ORDER = ['work', 'internship', 'project', 'education', 'certification', 'award', 'publication', 'patent', 'course', 'competition', 'open_source', 'startup', 'volunteer', 'language', 'custom']

const EVENT_TYPE_OPTIONS = EVENT_ORDER.map((key) => ({
  key,
  label: EVENT_TYPE_CONFIG[key]?.label || key,
}))

const EMPTY_EVENT_FORM = {
  event_type: 'work',
  title: '',
  role: '',
  organization: '',
  location: '',
  time_start: '',
  time_end: '',
  description: '',
  tags_text: '',
}

// ─── Component ────────────────────────────────────────────────

export default function VaultPage() {
  const [events, setEvents] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [readiness, setReadiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'events' | 'sources'>('events')
  const [uploading, setUploading] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [ingestText, setIngestText] = useState('')
  const [ingestUrls, setIngestUrls] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [createForm, setCreateForm] = useState<Record<string, any>>(EMPTY_EVENT_FORM)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [srcs, evts, rd] = await Promise.all([
        getSources().catch(() => ({ data: [] })),
        getEvents().catch(() => ({ data: [] })),
        getReadiness().catch(() => ({ data: null })),
      ])
      setSources((srcs as any).data || [])
      setEvents((evts as any).data || [])
      setReadiness((rd as any).data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Upload ──────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try { await uploadSourceFile(f); loadData() } catch (e) {}
    finally { setUploading(false) }
  }

  const handleIngest = async () => {
    const t = ingestText.trim()
    const urls = ingestUrls.split('\n').map(s => s.trim()).filter(s => s.startsWith('http'))
    if (!t && !urls.length) return
    setUploading(true)
    try {
      await createSource({ text: t, urls })
      setIngestText(''); setIngestUrls('')
      loadData()
    } catch {} finally { setUploading(false) }
  }

  // ── Edit inline ─────────────────────────────────────────────
  const startEdit = (event: any) => {
    setEditingId(event.id)
    setEditForm({
      title: event.title || '',
      role: event.role || '',
      organization: event.organization || '',
      description: event.description || '',
      time_start: event.time_start || '',
      time_end: event.time_end || '',
      location: event.location || '',
      tags_text: (event.tags || []).join('，'),
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    try {
      await updateEvent(editingId, {
        ...editForm,
        tags: splitTags(editForm.tags_text),
      })
      setEditingId(null)
      loadData()
    } catch {}
  }

  const handleCreateEvent = async () => {
    const title = String(createForm.title || '').trim()
    if (!title) return
    setSavingEvent(true)
    try {
      await createEvent({
        event_type: createForm.event_type,
        title,
        role: createForm.role || undefined,
        organization: createForm.organization || undefined,
        location: createForm.location || undefined,
        time_start: createForm.time_start || undefined,
        time_end: createForm.time_end || undefined,
        description: createForm.description || undefined,
        tags: splitTags(createForm.tags_text),
      })
      setCreateForm(EMPTY_EVENT_FORM)
      setShowCreate(false)
      setActiveTab('events')
      loadData()
    } catch {} finally {
      setSavingEvent(false)
    }
  }

  const handleConfirm = async (id: string) => {
    await confirmEvent(id).catch(() => {})
    loadData()
  }

  const handleArchive = async (id: string) => {
    await archiveEvent(id).catch(() => {})
    loadData()
  }

  // ── Grouped events ──────────────────────────────────────────
  const grouped = events.reduce((acc: Record<string, any[]>, ev: any) => {
    const t = ev.event_type || 'custom'
    if (!acc[t]) acc[t] = []
    acc[t].push(ev)
    return acc
  }, {})

  const groupOrder = EVENT_ORDER.filter(t => grouped[t]?.length)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-extrabold text-app-blue-ink">职业资料库</p>
          <h1 className="mt-1 text-[32px] font-black tracking-normal leading-tight">职业档案</h1>
          <p className="mt-2 max-w-[680px] text-sm leading-6 text-app-muted">上传一次，保留来源，审核提取结果。这里沉淀的是之后智能体认识你的身份上下文，不只是一次性简历。</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setShowCreate(true)}>手动新增经历</button>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>添加材料</button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.md,.txt" onChange={handleFile} className="hidden" />
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[430px_1fr]">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-3">
          {/* Unified input */}
          <div className="app-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">统一输入</h2>
              <span className="badge-cyan">源材料</span>
            </div>
            <div>
              <div className="mb-4 rounded-[22px] bg-[#fff0d6] p-4 text-sm font-semibold leading-6 text-[#86581f]">
                当前版本会先保存源材料；自动解析成经历事件还没有接入。保存材料后，可以用右上角“手动新增经历”把内容整理成结构化档案。
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                className="grid h-[178px] cursor-pointer place-items-center rounded-[26px] border-2 border-dashed border-[#d8cec4] bg-[#f8f4ef] text-center transition-colors hover:border-app-blue"
              >
                <div>
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[18px] bg-white text-xl font-black text-app-ink shadow-sm">↑</div>
                  <h3 className="text-base font-black">拖入简历、作品集、绩效评估</h3>
                  <p className="mt-1 text-xs font-semibold text-app-muted">文件、链接、粘贴文字都进入同一个入口</p>
                </div>
              </div>
              <div className="my-4 h-px bg-app-line-soft" />
              <textarea
                className="input min-h-[110px] resize-y"
                placeholder="粘贴简历片段、项目笔记、自我评估、BOSS/拉勾/猎聘岗位描述..."
                value={ingestText}
                onChange={e => setIngestText(e.target.value)}
              />
              <textarea
                className="input mt-2 min-h-[50px] resize-y"
                placeholder="粘贴链接，每行一个&#10;例如：https://github.com/yourname/project&#10;https://linkedin.com/in/yourname"
                value={ingestUrls}
                onChange={e => setIngestUrls(e.target.value)}
              />
              <button
                className="btn primary mt-3 w-full"
                onClick={handleIngest}
                disabled={uploading}
              >
                {uploading ? '保存中...' : '保存为源材料'}
              </button>
            </div>
          </div>

          {showCreate && (
            <div className="app-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">新增职业经历</h2>
                <button className="text-sm font-black text-app-muted hover:text-app-ink" onClick={() => setShowCreate(false)}>关闭</button>
              </div>
              <EventForm form={createForm} setForm={setCreateForm} />
              <button className="btn primary mt-3 w-full" onClick={handleCreateEvent} disabled={savingEvent || !String(createForm.title || '').trim()}>
                {savingEvent ? '保存中...' : '保存经历'}
              </button>
            </div>
          )}

          {/* Source list */}
          <div className="app-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">源材料</h2>
              <span className="badge-gray">{sources.length} 份</span>
            </div>
            <div className="space-y-3">
              {sources.slice(0, 5).map((s: any, i: number) => (
                <div key={s.id} className="flex gap-3 rounded-[20px] bg-[#f8f4ef] p-3">
                  <div className={`source-dot ${s.parse_status === 'parsed' ? 'confirmed' : ''}`}>
                    S{i+1}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                    <p className="text-xs text-app-muted">
                      {s.source_type === 'file' ? '文件' : '文本'} · {s.parse_status === 'parsed' ? '已解析' : s.parse_status === 'uploaded' ? '已保存，待整理' : s.parse_status}
                    </p>
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <p className="text-xs text-app-muted">还没有源材料，上传简历或粘贴经历开始</p>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-3">
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[26px] bg-[#f4c4ca] p-5">
              <p className="text-[28px] font-extrabold leading-none mb-1">{readiness?.total_events || 0}</p>
              <p className="text-[13px] font-bold text-app-ink/58">职业事件</p>
            </div>
            <div className="rounded-[26px] bg-[#c5efdf] p-5">
              <p className="text-[28px] font-extrabold leading-none mb-1">{readiness?.confirmed_events || 0}</p>
              <p className="text-[13px] font-bold text-app-ink/58">已确认</p>
            </div>
            <div className="rounded-[26px] bg-[#f8d7aa] p-5">
              <p className="text-[28px] font-extrabold leading-none mb-1">{readiness?.needs_review || 0}</p>
              <p className="text-[13px] font-bold text-app-ink/58">待审核</p>
            </div>
          </div>

          {/* Tabs: Timeline | Claims | Profile */}
          <div className="inline-flex overflow-hidden rounded-full border border-app-line bg-white/78 p-1">
            {[
              { key: 'events', label: '时间线' },
              { key: 'sources', label: '源材料' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={'h-[34px] rounded-full border-0 px-4 font-extrabold text-sm ' +
                  (activeTab === t.key ? 'bg-app-ink text-white' : 'bg-transparent text-app-muted')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Timeline */}
          {activeTab === 'events' && (
            <div className="app-card p-5">
              <div>
                <div className="space-y-5">
                  {loading && <p className="text-sm text-app-muted">正在加载职业经历...</p>}
                  {!loading && groupOrder.length === 0 && (
                    <div className="rounded-[24px] border border-dashed border-[#d8cec4] bg-white/58 p-6 text-center">
                      <p className="text-sm font-black">还没有职业经历</p>
                      <p className="mt-1 text-xs font-semibold text-app-muted">点击“手动新增经历”，先建立第一条工作、项目或教育经历。</p>
                      <button className="btn primary mt-4" onClick={() => setShowCreate(true)}>新增经历</button>
                    </div>
                  )}
                  {groupOrder.map(type => {
                    const typeMeta = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.custom
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-3 w-3 rounded-full" style={{ background: typeMeta.bar }} />
                          <span className="text-[12px] font-black text-app-ink">{typeMeta.label}</span>
                        </div>
                        <div className="space-y-3">
                          {grouped[type].map((ev: any) => {
                            const status = STATUS_CONFIG[ev.status] || STATUS_CONFIG.draft
                            return editingId === ev.id ? (
                              <div key={ev.id} className="space-y-2 rounded-[22px] border border-app-blue/30 bg-white/78 p-4">
                                <input className="input text-sm" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} placeholder="标题" />
                                <div className="grid grid-cols-2 gap-2">
                                  <input className="input text-sm" value={editForm.organization} onChange={e => setEditForm({...editForm, organization: e.target.value})} placeholder="公司/组织" />
                                  <input className="input text-sm" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} placeholder="职位/角色" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input className="input text-sm" value={editForm.time_start} onChange={e => setEditForm({...editForm, time_start: e.target.value})} placeholder="开始时间，如 2025-06" />
                                  <input className="input text-sm" value={editForm.time_end} onChange={e => setEditForm({...editForm, time_end: e.target.value})} placeholder="结束时间，如 2025-09" />
                                </div>
                                <input className="input text-sm" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} placeholder="地点" />
                                <textarea className="input text-sm min-h-[60px]" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} placeholder="描述" />
                                <input className="input text-sm" value={editForm.tags_text} onChange={e => setEditForm({...editForm, tags_text: e.target.value})} placeholder="标签，用逗号分隔" />
                                <div className="flex gap-2 justify-end">
                                  <button className="btn text-xs h-8" onClick={() => setEditingId(null)}>取消</button>
                                  <button className="btn primary text-xs h-8" onClick={saveEdit}>保存</button>
                                </div>
                              </div>
                            ) : (
                              <div key={ev.id} className="flex cursor-pointer justify-between gap-3 rounded-[22px] p-4 transition hover:shadow-panel" style={{ background: typeMeta.bg }} onClick={() => startEdit(ev)}>
                                <div>
                                  <h3 className="text-sm font-semibold">{ev.title}</h3>
                                  <p className="text-xs text-app-muted mt-0.5">
                                    {[ev.organization, ev.time_start, ev.time_end && `— ${ev.time_end}`].filter(Boolean).join(' · ')}
                                  </p>
                                  {ev.description && <p className="text-xs text-app-muted mt-1 line-clamp-2">{ev.description}</p>}
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {ev.status !== 'confirmed' && (
                                      <button
                                        className="badge-green"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleConfirm(ev.id)
                                        }}
                                      >
                                        确认
                                      </button>
                                    )}
                                    {ev.status !== 'archived' && (
                                      <button
                                        className="badge-gray"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleArchive(ev.id)
                                        }}
                                      >
                                        归档
                                      </button>
                                    )}
                                  </div>
                                  {ev.tags?.length > 0 && (
                                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                      {ev.tags.map((t: string) => <span key={t} className="badge-blue text-[11px]">{t}</span>)}
                                    </div>
                                  )}
                                </div>
                                <span className={`${status.cls} h-fit text-[11px]`}>{status.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="app-card p-5">
              <div className="space-y-3">
                {sources.map((s: any, i: number) => (
                  <div key={s.id} className="flex gap-3 rounded-[20px] bg-[#f8f4ef] p-3">
                    <div className={`source-dot ${s.parse_status === 'parsed' ? 'confirmed' : ''}`}>S{i+1}</div>
                    <div>
                      <h3 className="text-sm font-semibold">{s.title}</h3>
                      <p className="text-xs text-app-muted">{s.source_type === 'file' ? '文件' : '文本'} · {s.parse_status === 'uploaded' ? '已保存，待整理' : s.parse_status} · {s.created_at}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function EventForm({ form, setForm }: { form: Record<string, any>; setForm: (form: Record<string, any>) => void }) {
  return (
    <div className="space-y-2">
      <select className="input" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
        {EVENT_TYPE_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
      <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="标题，例如：AI 简历评估器 / 产品运营实习" />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} placeholder="公司/学校/组织" />
        <input className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="角色/职位" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" value={form.time_start} onChange={e => setForm({ ...form, time_start: e.target.value })} placeholder="开始时间，如 2025-06" />
        <input className="input" value={form.time_end} onChange={e => setForm({ ...form, time_end: e.target.value })} placeholder="结束时间，如 2025-09" />
      </div>
      <input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="地点，例如：北京 / 远程" />
      <textarea className="input min-h-[92px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="描述这段经历：职责、成果、指标、使用的方法或工具。" />
      <input className="input" value={form.tags_text} onChange={e => setForm({ ...form, tags_text: e.target.value })} placeholder="标签，用逗号分隔，例如：产品分析，智能体，简历评估" />
    </div>
  )
}

function splitTags(value: string | undefined) {
  return String(value || '')
    .split(/[，,]/)
    .map(tag => tag.trim())
    .filter(Boolean)
}
