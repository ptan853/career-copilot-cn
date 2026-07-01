'use client'

import { useEffect, useRef, useState } from 'react'
import {
  clearVault,
  createSource,
  deleteSource,
  uploadSource as uploadSourceFile,
  getSources,
  getSource,
  getGroupedEvents,
  createEvent,
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

type SourceItem = {
  id: string
  title: string
  source_type: string
  parse_status: string
  raw_text_preview?: string
  parse_error?: string | null
  created_at: string
}

type PendingFile = {
  id: string
  file: File
  status: 'selected' | 'uploading' | 'failed'
  error?: string
}

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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function sourceStatusLabel(status: string) {
  if (status === 'parsed') return '已解析'
  if (status === 'extracted') return '已提取，等待 AI'
  if (status === 'extracting') return 'AI 解析中'
  if (status === 'failed') return '失败'
  return '队列中'
}

export default function VaultPage() {
  const [text, setText] = useState('')
  const [urls, setUrls] = useState('')
  const [inputHint, setInputHint] = useState('')
  const [fileUploading, setFileUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [sources, setSources] = useState<SourceItem[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sections, setSections] = useState<VaultSection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeEvent, setActiveEvent] = useState<VaultEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm | null>(null)
  const [claims, setClaims] = useState<VaultClaim[]>([])
  const [newClaimText, setNewClaimText] = useState('')
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [clearingVault, setClearingVault] = useState(false)
  const [newEventForm, setNewEventForm] = useState<EventForm>({
    title: '',
    event_type: 'work',
    role: '',
    organization: '',
    location: '',
    time_start: '',
    time_end: '',
    time_precision: 'month',
    description: '',
    visibility: 'private',
    status: 'draft',
    tags_text: '',
    details: { ...EMPTY_DETAILS },
  })
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

  async function loadSources() {
    setSourcesLoading(true)
    try {
      const response: any = await getSources()
      const summaries: SourceItem[] = response.data || []
      const hydrated = await Promise.all(
        summaries.slice(0, 8).map(async (source) => {
          try {
            const detail: any = await getSource(source.id)
            return {
              ...source,
              raw_text_preview: detail.data?.raw_text_preview || source.raw_text_preview || '',
              parse_error: detail.data?.parse_error || source.parse_error || null,
            }
          } catch {
            return source
          }
        }),
      )
      setSources(hydrated)
    } catch {
      setStatusMessage('源材料加载失败，请确认已登录')
    } finally {
      setSourcesLoading(false)
    }
  }

  useEffect(() => {
    loadSections()
    loadSources()
    const sectionTimer = window.setInterval(loadSections, 5000)
    const sourceTimer = window.setInterval(loadSources, 4000)
    return () => {
      window.clearInterval(sectionTimer)
      window.clearInterval(sourceTimer)
    }
  }, [])

  async function submitTextSource(options: { silent?: boolean } = {}) {
    const cleanText = text.trim()
    const cleanUrls = urls.split('\n').map((url) => url.trim()).filter((url) => url.startsWith('http'))
    if (!cleanText && cleanUrls.length === 0) {
      if (!options.silent) setStatusMessage('请先输入文字或链接')
      return
    }
    setSubmitting(true)
    if (!options.silent) setStatusMessage('正在创建解析任务...')
    try {
      await createSource({ text: cleanText, urls: cleanUrls, input_hint: inputHint.trim() })
      setText('')
      setUrls('')
      setInputHint('')
      if (!options.silent) {
        setStatusMessage('已提交，解析完成后会出现在右侧')
        await loadSources()
        await loadSections()
      }
    } catch {
      setStatusMessage('提交失败，请检查登录状态或 API 设置')
    } finally {
      setSubmitting(false)
    }
  }

  function addPendingFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length) return
    setPendingFiles((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`,
        file,
        status: 'selected' as const,
      })),
    ])
    setStatusMessage('文件已加入待处理列表，点击“开始解析”后上传。')
  }

  async function analyzePendingFiles() {
    if (!pendingFiles.length && !text.trim() && !urls.trim()) {
      setStatusMessage('请先选择文件、输入文字或填写链接')
      return
    }

    setFileUploading(true)
    setStatusMessage('正在解析材料...')
    try {
      if (pendingFiles.length) {
        for (const item of pendingFiles) {
          setPendingFiles((current) =>
            current.map((fileItem) => fileItem.id === item.id ? { ...fileItem, status: 'uploading' } : fileItem),
          )
          try {
            await uploadSourceFile(item.file)
            setPendingFiles((current) => current.filter((fileItem) => fileItem.id !== item.id))
          } catch (error: any) {
            setPendingFiles((current) =>
              current.map((fileItem) =>
                fileItem.id === item.id
                  ? { ...fileItem, status: 'failed', error: error?.message || '上传失败' }
                  : fileItem,
              ),
            )
          }
        }
      }

      if (text.trim() || urls.trim()) {
        await submitTextSource({ silent: true })
      }

      setStatusMessage('材料已提交，系统正在解析。下方会自动刷新状态。')
      await loadSources()
      await loadSections()
    } catch (error: any) {
      setStatusMessage(error?.message || '解析失败')
    } finally {
      setFileUploading(false)
    }
  }

  async function removePendingFile(id: string) {
    setPendingFiles((current) => current.filter((item) => item.id !== id))
  }

  async function removeSource(source: SourceItem) {
    if (!window.confirm(`确定删除「${source.title}」？关联解析结果也会一起删除。`)) return
    try {
      await deleteSource(source.id)
      setStatusMessage('材料已删除')
      await loadSources()
      await loadSections()
    } catch (error: any) {
      setStatusMessage(error?.message || '删除失败')
    }
  }

  async function clearCurrentVault() {
    if (!window.confirm('这将清空所有职业档案、经历事件、claims、evidence 和源材料记录。此操作不可恢复。')) return
    setClearingVault(true)
    try {
      await clearVault()
      setPendingFiles([])
      setSources([])
      setSections([])
      setActiveEvent(null)
      setEventForm(null)
      setStatusMessage('职业档案已清空')
      await loadSources()
      await loadSections()
    } catch (error: any) {
      setStatusMessage(error?.message || '清空失败')
    } finally {
      setClearingVault(false)
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

  async function createNewEvent() {
    if (!newEventForm.title.trim()) {
      setStatusMessage('请至少填写事件标题')
      return
    }
    try {
      await createEvent({
        event_type: newEventForm.event_type,
        title: newEventForm.title.trim(),
        role: newEventForm.role || undefined,
        organization: newEventForm.organization || undefined,
        location: newEventForm.location || undefined,
        time_start: newEventForm.time_start || undefined,
        time_end: newEventForm.time_end || undefined,
        description: newEventForm.description || undefined,
        details_json: newEventForm.details,
        tags: splitTags(newEventForm.tags_text),
      })
      setStatusMessage('事件已创建')
      setShowNewEventModal(false)
      setNewEventForm({
        title: '',
        event_type: 'work',
        role: '',
        organization: '',
        location: '',
        time_start: '',
        time_end: '',
        time_precision: 'month',
        description: '',
        visibility: 'private',
        status: 'draft',
        tags_text: '',
        details: { ...EMPTY_DETAILS },
      })
      await loadSections()
    } catch {
      setStatusMessage('创建失败，请检查登录状态或 API 设置')
    }
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

        <button
          type="button"
          className="drop-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addPendingFiles(event.dataTransfer.files)
          }}
          disabled={fileUploading}
        >
          <span>上传材料</span>
          <strong>拖拽文件，或点击选择</strong>
          <small>支持 PDF、Word、文本材料；选择后点击“开始解析”</small>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) addPendingFiles(event.target.files)
            event.currentTarget.value = ''
          }}
        />

        {(pendingFiles.length > 0 || sources.length > 0) && (
          <div className="material-list">
            {pendingFiles.map((item, index) => (
              <div key={item.id} className={`material-row ${item.status === 'failed' ? 'failed' : ''}`}>
                <span className="material-index">{index + 1}</span>
                <div className="material-main">
                  <strong>{item.file.name}</strong>
                  <span>{formatFileSize(item.file.size)} · {item.status === 'uploading' ? '上传中' : item.status === 'failed' ? item.error || '上传失败' : '待解析'}</span>
                </div>
                <button type="button" onClick={() => removePendingFile(item.id)} disabled={item.status === 'uploading'} aria-label="删除文件">
                  ×
                </button>
              </div>
            ))}

            {sources.map((source, index) => {
              const analyzed = source.parse_status === 'parsed'
              return (
                <div key={source.id} className={`material-row ${analyzed ? 'analyzed' : ''} ${source.parse_status === 'failed' ? 'failed' : ''}`}>
                  <span className="material-index">{pendingFiles.length + index + 1}</span>
                  <div className="material-main">
                    <strong>{source.title}</strong>
                    <span>
                      {source.source_type === 'file' ? '文件' : '文本'} · {sourceStatusLabel(source.parse_status)}
                      {source.parse_error ? ` · ${source.parse_error}` : ''}
                    </span>
                  </div>
                  <em>{sourceStatusLabel(source.parse_status)}</em>
                  <button type="button" onClick={() => removeSource(source)} aria-label="删除材料">
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

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

        <button className="submit-source" onClick={analyzePendingFiles} disabled={submitting || fileUploading}>
          {submitting || fileUploading ? '解析中...' : '开始解析'}
        </button>
        {statusMessage && <p className="status-message">{statusMessage}</p>}

        <div className="source-list">
          <div className="source-list-heading">
            <h2>已解析内容</h2>
            <button type="button" onClick={loadSources}>刷新</button>
          </div>
          {sourcesLoading ? (
            <p className="source-list-empty">正在加载材料...</p>
          ) : sources.length === 0 ? (
            <p className="source-list-empty">解析完成后，会在这里展示提取出的文本内容。</p>
          ) : (
            <div className="source-list-stack">
              {sources.slice(0, 6).map((source) => (
                <div key={source.id} className="source-list-item">
                  <div>
                    <strong>{source.title}</strong>
                    <span>
                      {source.parse_error
                        ? `解析失败：${source.parse_error}`
                        : source.raw_text_preview || '已进入队列，等待 AI 生成结构化事件。'}
                    </span>
                  </div>
                  <em>{sourceStatusLabel(source.parse_status)}</em>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="vault-profile">
        <div className="vault-profile-header">
          <div>
            <p className="eyebrow">职业档案</p>
            <h1>按经历类型沉淀身份资产</h1>
          </div>
          <div className="vault-profile-actions">
            <button onClick={loadSections}>刷新</button>
            <button className="danger" onClick={clearCurrentVault} disabled={clearingVault}>
              {clearingVault ? '清空中...' : '清空 Profile'}
            </button>
          </div>
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

        {!loading && (
          <div className="manual-add-area">
            <button className="manual-add-btn" onClick={() => setShowNewEventModal(true)}>
              手动新增经历
            </button>
            <p>也可以不依赖 AI，直接手动填写工作、项目、教育等类型的事件。</p>
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

      {showNewEventModal && (
        <div className="modal-backdrop" onClick={() => setShowNewEventModal(false)}>
          <div className="event-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">手动新增经历</p>
                <h2>新建事件</h2>
              </div>
              <button onClick={() => setShowNewEventModal(false)}>关闭</button>
            </div>

            <div className="modal-grid">
              <label>标题<input value={newEventForm.title} onChange={(event) => setNewEventForm({ ...newEventForm, title: event.target.value })} placeholder="例如：增长产品实习" /></label>
              <label>类型<select value={newEventForm.event_type} onChange={(event) => setNewEventForm({ ...newEventForm, event_type: event.target.value })}>{EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>角色<input value={newEventForm.role} onChange={(event) => setNewEventForm({ ...newEventForm, role: event.target.value })} placeholder="例如：产品实习生" /></label>
              <label>组织<input value={newEventForm.organization} onChange={(event) => setNewEventForm({ ...newEventForm, organization: event.target.value })} placeholder="例如：字节跳动" /></label>
              <label>地点<input value={newEventForm.location} onChange={(event) => setNewEventForm({ ...newEventForm, location: event.target.value })} placeholder="例如：北京" /></label>
              <label>开始时间<input value={newEventForm.time_start} onChange={(event) => setNewEventForm({ ...newEventForm, time_start: event.target.value })} placeholder="2024-06" /></label>
              <label>结束时间<input value={newEventForm.time_end} onChange={(event) => setNewEventForm({ ...newEventForm, time_end: event.target.value })} placeholder="2025-03" /></label>
              <label>标签<input value={newEventForm.tags_text} onChange={(event) => setNewEventForm({ ...newEventForm, tags_text: event.target.value })} placeholder="增长, A/B 测试" /></label>
            </div>

            <label className="modal-field">描述<textarea value={newEventForm.description} onChange={(event) => setNewEventForm({ ...newEventForm, description: event.target.value })} placeholder="简要描述这段经历..." /></label>
            <div className="detail-grid">
              <label>背景<textarea value={newEventForm.details.context} onChange={(event) => setNewEventForm({ ...newEventForm, details: { ...newEventForm.details, context: event.target.value } })} placeholder="这段经历的背景是什么？" /></label>
              <label>个人贡献<textarea value={newEventForm.details.contribution} onChange={(event) => setNewEventForm({ ...newEventForm, details: { ...newEventForm.details, contribution: event.target.value } })} placeholder="你的具体贡献是什么？" /></label>
              <label>实现方法<textarea value={newEventForm.details.implementation} onChange={(event) => setNewEventForm({ ...newEventForm, details: { ...newEventForm.details, implementation: event.target.value } })} placeholder="采用了什么方法或技术？" /></label>
              <label>结果<textarea value={newEventForm.details.outcome} onChange={(event) => setNewEventForm({ ...newEventForm, details: { ...newEventForm.details, outcome: event.target.value } })} placeholder="带来了什么可量化的结果？" /></label>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowNewEventModal(false)}>取消</button>
              <button onClick={createNewEvent} className="primary">创建事件</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
