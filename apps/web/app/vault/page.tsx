'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createSource,
  uploadSource as uploadSourceFile,
  getGroupedEvents,
  updateEvent,
  confirmEvent,
  deleteEvent,
  getClaims,
  createClaim,
  updateClaim,
  deleteClaim,
  type VaultEvent,
  type VaultSection,
  type VaultClaim,
} from '@/lib/api-client'

const STATUS_LABELS: Record<string, string> = {
  draft: '待确认',
  needs_review: '需补充',
  confirmed: '已确认',
  archived: '已归档',
}

const EVENT_TYPE_OPTIONS = [
  ['work', '工作'],
  ['internship', '实习'],
  ['project', '项目'],
  ['education', '教育'],
  ['certification', '证书'],
  ['award', '奖项'],
  ['publication', '论文/发表'],
  ['open_source', '开源'],
  ['startup', '创业'],
  ['language', '语言'],
  ['custom', '自定义'],
]

const EMPTY_DETAILS = {
  context: '',
  contribution: '',
  implementation: '',
  outcome: '',
  open_questions: [],
  needs_review_fields: [],
}

type EventForm = ReturnType<typeof eventToForm>

function eventToForm(event: VaultEvent) {
  return {
    title: event.title || '',
    event_type: event.event_type || 'custom',
    role: event.role || '',
    organization: event.organization || '',
    location: event.location || '',
    time_start: event.time_start || '',
    time_end: event.time_end || '',
    time_precision: event.time_precision || 'month',
    description: event.description || '',
    visibility: event.visibility || 'private',
    status: event.status || 'draft',
    tags_text: (event.tags || []).join('，'),
    details: { ...EMPTY_DETAILS, ...(event.details_json || {}) },
  }
}

function splitTags(value: string) {
  return value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)
}

function confidenceLabel(value?: number | null) {
  if (typeof value !== 'number') return '--'
  return `${Math.round(value * 100)}%`
}

export default function VaultPage() {
  const [text, setText] = useState('')
  const [urls, setUrls] = useState('')
  const [inputHint, setInputHint] = useState('')
  const [fileUploading, setFileUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [sections, setSections] = useState<VaultSection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEvent, setActiveEvent] = useState<VaultEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm | null>(null)
  const [claims, setClaims] = useState<VaultClaim[]>([])
  const [newClaimText, setNewClaimText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadSections() {
    setLoading(true)
    try {
      const response = await getGroupedEvents()
      setSections(response.data || [])
    } catch {
      setStatusMessage('职业档案加载失败，请确认已登录')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSections()
    const timer = window.setInterval(loadSections, 5000)
    return () => window.clearInterval(timer)
  }, [])

  async function submitTextSource() {
    const cleanText = text.trim()
    const cleanUrls = urls.split('\n').map((url) => url.trim()).filter((url) => url.startsWith('http'))
    if (!cleanText && cleanUrls.length === 0) {
      setStatusMessage('请先输入文字或链接')
      return
    }
    setSubmitting(true)
    setStatusMessage('正在创建解析任务...')
    try {
      await createSource({ text: cleanText, urls: cleanUrls, input_hint: inputHint.trim() })
      setText('')
      setUrls('')
      setInputHint('')
      setStatusMessage('已提交，解析完成后会出现在右侧')
      await loadSections()
    } catch {
      setStatusMessage('提交失败，请检查登录状态或 API 设置')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitFile(file: File) {
    setFileUploading(true)
    setStatusMessage('正在上传文件...')
    try {
      await uploadSourceFile(file)
      setStatusMessage('文件已上传，解析完成后会出现在右侧')
      await loadSections()
    } catch {
      setStatusMessage('文件上传失败')
    } finally {
      setFileUploading(false)
    }
  }

  async function openEvent(event: VaultEvent) {
    setActiveEvent(event)
    setEventForm(eventToForm(event))
    try {
      const response: any = await getClaims({ event_id: event.id })
      setClaims(response.data || [])
    } catch {
      setClaims([])
    }
  }

  async function saveEvent() {
    if (!activeEvent || !eventForm) return
    await updateEvent(activeEvent.id, {
      title: eventForm.title,
      event_type: eventForm.event_type,
      role: eventForm.role || null,
      organization: eventForm.organization || null,
      location: eventForm.location || null,
      time_start: eventForm.time_start || null,
      time_end: eventForm.time_end || null,
      time_precision: eventForm.time_precision,
      description: eventForm.description || null,
      details_json: eventForm.details,
      tags: splitTags(eventForm.tags_text),
      visibility: eventForm.visibility,
      status: eventForm.status,
    })
    setStatusMessage('事件已保存')
    await loadSections()
  }

  async function confirmActiveEvent() {
    if (!activeEvent) return
    await confirmEvent(activeEvent.id)
    setActiveEvent(null)
    setEventForm(null)
    await loadSections()
  }

  async function deleteActiveEvent() {
    if (!activeEvent) return
    if (!window.confirm('确定删除这个事件？相关 claims 和 evidence 也会删除。')) return
    await deleteEvent(activeEvent.id)
    setActiveEvent(null)
    setEventForm(null)
    await loadSections()
  }

  async function addClaim() {
    if (!activeEvent || !newClaimText.trim()) return
    await createClaim({
      event_id: activeEvent.id,
      claim_text: newClaimText.trim(),
      claim_type: 'achievement',
      strength: 'confirmed',
    })
    setNewClaimText('')
    await openEvent(activeEvent)
    await loadSections()
  }

  async function removeClaim(claimId: string) {
    if (!activeEvent) return
    await deleteClaim(claimId)
    await openEvent(activeEvent)
    await loadSections()
  }

  async function renameClaim(claim: VaultClaim, claimText: string) {
    if (!activeEvent || !claimText.trim() || claimText === claim.claim_text) return
    await updateClaim(claim.id, { claim_text: claimText.trim() })
    await openEvent(activeEvent)
    await loadSections()
  }

  return (
    <div className="vault-builder">
      <section className="source-panel">
        <div className="panel-heading">
          <p className="eyebrow">统一输入</p>
          <h1>把材料交给 AI 识别</h1>
          <p>简历、项目笔记、作品链接和国内招聘平台文本都从这里进入同一个职业档案。</p>
        </div>

        <button className="drop-zone" onClick={() => fileRef.current?.click()} disabled={fileUploading}>
          <span>上传文件</span>
          <strong>{fileUploading ? '上传中...' : 'PDF / Word / 文本材料'}</strong>
          <small>保留原始材料，再解析成可编辑事件</small>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) submitFile(file)
            event.currentTarget.value = ''
          }}
        />

        <label className="field-block">
          <span>文字材料</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴简历片段、项目复盘、绩效反馈、自我介绍..." />
        </label>
        <label className="field-block">
          <span>链接</span>
          <textarea value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="每行一个链接，例如 GitHub、作品集、BOSS/拉勾/猎聘岗位链接" />
        </label>
        <label className="field-block">
          <span>给 AI 的提示</span>
          <input value={inputHint} onChange={(event) => setInputHint(event.target.value)} placeholder="例如：重点识别产品经历和量化成果" />
        </label>

        <button className="submit-source" onClick={submitTextSource} disabled={submitting || fileUploading}>
          {submitting ? '提交中...' : '提交并解析'}
        </button>
        {statusMessage && <p className="status-message">{statusMessage}</p>}
      </section>

      <section className="vault-profile">
        <div className="vault-profile-header">
          <div>
            <p className="eyebrow">职业档案</p>
            <h1>按经历类型沉淀身份资产</h1>
          </div>
          <button onClick={loadSections}>刷新</button>
        </div>

        {loading ? (
          <div className="empty-state">正在加载职业档案...</div>
        ) : sections.length === 0 ? (
          <div className="empty-state">左侧输入材料后，AI 会在这里按分类生成经历卡片。</div>
        ) : (
          <div className="section-stack">
            {sections.map((section) => (
              <div key={`${section.section_type}:${section.section_title}`} className="profile-section">
                <div className="section-heading">
                  <h2>{section.section_title}</h2>
                  <span>{section.events.length} 个事件</span>
                </div>
                <div className="event-grid">
                  {section.events.map((event) => (
                    <button key={event.id} className="event-card" onClick={() => openEvent(event)}>
                      <div className="event-card-top">
                        <span>{STATUS_LABELS[event.status] || event.status}</span>
                        <span>{confidenceLabel(event.source_confidence)}</span>
                      </div>
                      <h3>{event.title}</h3>
                      <p>{[event.organization, event.role].filter(Boolean).join(' · ') || '未填写组织/角色'}</p>
                      <p>{[event.time_start, event.time_end].filter(Boolean).join(' - ') || '时间待补充'}</p>
                      <div className="event-meta-row">
                        <span>{event.claims_count || 0} claims</span>
                        <span>{event.evidence_count || 0} evidence</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {activeEvent && eventForm && (
        <div className="modal-backdrop" onClick={() => setActiveEvent(null)}>
          <div className="event-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">编辑事件</p>
                <h2>{activeEvent.title}</h2>
              </div>
              <button onClick={() => setActiveEvent(null)}>关闭</button>
            </div>

            <div className="modal-grid">
              <label>标题<input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} /></label>
              <label>类型<select value={eventForm.event_type} onChange={(event) => setEventForm({ ...eventForm, event_type: event.target.value })}>{EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>角色<input value={eventForm.role} onChange={(event) => setEventForm({ ...eventForm, role: event.target.value })} /></label>
              <label>组织<input value={eventForm.organization} onChange={(event) => setEventForm({ ...eventForm, organization: event.target.value })} /></label>
              <label>地点<input value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} /></label>
              <label>开始时间<input value={eventForm.time_start} onChange={(event) => setEventForm({ ...eventForm, time_start: event.target.value })} /></label>
              <label>结束时间<input value={eventForm.time_end} onChange={(event) => setEventForm({ ...eventForm, time_end: event.target.value })} /></label>
              <label>标签<input value={eventForm.tags_text} onChange={(event) => setEventForm({ ...eventForm, tags_text: event.target.value })} /></label>
            </div>

            <label className="modal-field">描述<textarea value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></label>
            <div className="detail-grid">
              <label>背景<textarea value={eventForm.details.context} onChange={(event) => setEventForm({ ...eventForm, details: { ...eventForm.details, context: event.target.value } })} /></label>
              <label>个人贡献<textarea value={eventForm.details.contribution} onChange={(event) => setEventForm({ ...eventForm, details: { ...eventForm.details, contribution: event.target.value } })} /></label>
              <label>实现方法<textarea value={eventForm.details.implementation} onChange={(event) => setEventForm({ ...eventForm, details: { ...eventForm.details, implementation: event.target.value } })} /></label>
              <label>结果<textarea value={eventForm.details.outcome} onChange={(event) => setEventForm({ ...eventForm, details: { ...eventForm.details, outcome: event.target.value } })} /></label>
            </div>

            <div className="claims-panel">
              <div className="claims-heading">
                <h3>可复用事实</h3>
                <span>{claims.length} 条</span>
              </div>
              {claims.map((claim) => (
                <div key={claim.id} className="claim-row">
                  <input defaultValue={claim.claim_text} onBlur={(event) => renameClaim(claim, event.target.value)} />
                  <button onClick={() => removeClaim(claim.id)}>删除</button>
                </div>
              ))}
              <div className="claim-row">
                <input value={newClaimText} onChange={(event) => setNewClaimText(event.target.value)} placeholder="新增可复用事实" />
                <button onClick={addClaim}>添加</button>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={deleteActiveEvent} className="danger">删除事件</button>
              <button onClick={saveEvent}>保存修改</button>
              <button onClick={confirmActiveEvent} className="primary">确认入库</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
