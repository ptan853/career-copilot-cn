'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  getProfile,
  type VaultEvent,
  type VaultSection,
} from '@/lib/api-client'
import {
  getBullets,
  getLiteSectionTitle,
  getLiteSectionType,
  getSkills,
  getStringList,
  getTechStack,
  joinDateRange,
  PROFILE_SECTION_ORDER,
  splitMultilineList,
} from '@/lib/vault-lite-schema'

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
  ['course', '课程'],
  ['award', '奖项'],
  ['competition', '竞赛'],
  ['publication', '论文/发表'],
  ['patent', '专利'],
  ['open_source', '开源'],
  ['startup', '创业'],
  ['volunteer', '志愿/社团'],
  ['language', '语言'],
  ['custom', '其他'],
]

const EMPTY_DETAILS = {
  bullets: [] as string[],
  skills: [] as string[],
  tech_stack: [] as string[],
  url: '',
  field: '',
  gpa: '',
  honors: [] as string[],
  authors: [] as string[],
  proficiency: '',
  context: '',
  contribution: '',
  implementation: '',
  outcome: '',
  open_questions: [] as string[],
  needs_review_fields: [] as string[],
}

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

type ProfileData = {
  full_name?: string | null
  headline?: string | null
  emails?: string[]
  phones?: string[]
  location?: string | null
  links?: Array<{ label?: string; url?: string }>
  summary?: string | null
  years_of_experience?: number | null
}

type EventForm = {
  title: string
  event_type: string
  role: string
  organization: string
  location: string
  time_start: string
  time_end: string
  time_precision: string
  description: string
  visibility: string
  status: string
  tags_text: string
  bullets_text: string
  skills_text: string
  tech_stack_text: string
  url: string
  field: string
  gpa: string
  honors_text: string
  authors_text: string
  proficiency: string
}

function eventToForm(event: VaultEvent): EventForm {
  const details = { ...EMPTY_DETAILS, ...(event.details_json || {}) }
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
    bullets_text: getStringList(details.bullets).join('\n'),
    skills_text: getStringList(details.skills).join('，'),
    tech_stack_text: getStringList(details.tech_stack).join('，'),
    url: typeof details.url === 'string' ? details.url : '',
    field: typeof details.field === 'string' ? details.field : '',
    gpa: typeof details.gpa === 'string' ? details.gpa : '',
    honors_text: getStringList(details.honors).join('，'),
    authors_text: getStringList(details.authors).join('，'),
    proficiency: typeof details.proficiency === 'string' ? details.proficiency : '',
  }
}

function emptyEventForm(eventType = 'work'): EventForm {
  return {
    title: '',
    event_type: eventType,
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
    bullets_text: '',
    skills_text: '',
    tech_stack_text: '',
    url: '',
    field: '',
    gpa: '',
    honors_text: '',
    authors_text: '',
    proficiency: '',
  }
}

function splitTags(value: string) {
  return value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)
}

function listFromCommaText(value: string) {
  return value.split(/[，,]/).map((item) => item.trim()).filter(Boolean)
}

function detailsFromForm(form: EventForm) {
  const details: Record<string, any> = {}
  const bullets = splitMultilineList(form.bullets_text)
  const skills = listFromCommaText(form.skills_text)
  const techStack = listFromCommaText(form.tech_stack_text)
  const honors = listFromCommaText(form.honors_text)
  const authors = listFromCommaText(form.authors_text)

  if (bullets.length) details.bullets = bullets
  if (skills.length) details.skills = skills
  if (techStack.length) details.tech_stack = techStack
  if (honors.length) details.honors = honors
  if (authors.length) details.authors = authors
  if (form.url.trim()) details.url = form.url.trim()
  if (form.field.trim()) details.field = form.field.trim()
  if (form.gpa.trim()) details.gpa = form.gpa.trim()
  if (form.proficiency.trim()) details.proficiency = form.proficiency.trim()

  return details
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

function sectionSortValue(sectionType: string) {
  const index = PROFILE_SECTION_ORDER.indexOf(sectionType)
  return index === -1 ? 999 : index
}

function groupForResume(sections: VaultSection[]) {
  const groups = new Map<string, VaultEvent[]>()
  for (const section of sections) {
    for (const event of section.events || []) {
      const sectionType = getLiteSectionType(event)
      groups.set(sectionType, [...(groups.get(sectionType) || []), event])
    }
  }
  return [...groups.entries()]
    .map(([section_type, events]) => ({ section_type, section_title: getLiteSectionTitle(section_type), events }))
    .sort((a, b) => sectionSortValue(a.section_type) - sectionSortValue(b.section_type))
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
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeEvent, setActiveEvent] = useState<VaultEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm | null>(null)
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [clearingVault, setClearingVault] = useState(false)
  const [newEventForm, setNewEventForm] = useState<EventForm>(emptyEventForm())
  const fileRef = useRef<HTMLInputElement>(null)

  const resumeSections = useMemo(() => groupForResume(sections), [sections])

  async function loadProfile() {
    try {
      const response: any = await getProfile()
      setProfile(response.data || null)
    } catch {
      setProfile(null)
    }
  }

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
    loadProfile()
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

      setStatusMessage('材料已提交，系统正在解析。右侧会自动刷新。')
      await loadSources()
      await loadSections()
    } catch (error: any) {
      setStatusMessage(error?.message || '解析失败')
    } finally {
      setFileUploading(false)
    }
  }

  function removePendingFile(id: string) {
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
    if (!window.confirm('这将清空所有职业档案、经历事件、证据和源材料记录。此操作不可恢复。')) return
    setClearingVault(true)
    try {
      await clearVault()
      setPendingFiles([])
      setSources([])
      setSections([])
      setActiveEvent(null)
      setEventForm(null)
      setProfile(null)
      setStatusMessage('职业档案已清空')
      await loadProfile()
      await loadSources()
      await loadSections()
    } catch (error: any) {
      setStatusMessage(error?.message || '清空失败')
    } finally {
      setClearingVault(false)
    }
  }

  function openEvent(event: VaultEvent) {
    setActiveEvent(event)
    setEventForm(eventToForm(event))
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
      details_json: detailsFromForm(eventForm),
      tags: splitTags(eventForm.tags_text),
      visibility: eventForm.visibility,
      status: eventForm.status,
    })
    setStatusMessage('已保存')
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
    if (!window.confirm('确定删除这个条目？相关证据也会删除。')) return
    await deleteEvent(activeEvent.id)
    setActiveEvent(null)
    setEventForm(null)
    await loadSections()
  }

  async function createNewEvent() {
    if (!newEventForm.title.trim()) {
      setStatusMessage('请至少填写标题')
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
        details_json: detailsFromForm(newEventForm),
        tags: splitTags(newEventForm.tags_text),
      })
      setStatusMessage('条目已创建')
      setShowNewEventModal(false)
      setNewEventForm(emptyEventForm())
      await loadSections()
    } catch {
      setStatusMessage('创建失败，请检查登录状态或 API 设置')
    }
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
                    <span>{source.source_type === 'file' ? '文件' : '文本'} · {sourceStatusLabel(source.parse_status)}</span>
                    {source.parse_error && <p className="material-error">{source.parse_error}</p>}
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
                <div key={source.id} className={`source-list-item ${source.parse_status === 'failed' ? 'failed' : ''}`}>
                  <div>
                    <strong>{source.title}</strong>
                    <span>
                      {source.parse_error
                        ? `解析失败：${source.parse_error}`
                        : source.raw_text_preview || '已进入队列，等待 AI 生成结构化档案。'}
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
            <h1>像简历一样管理经历资产</h1>
          </div>
          <div className="vault-profile-actions">
            <button onClick={() => { loadProfile(); loadSections() }}>刷新</button>
            <button className="danger" onClick={clearCurrentVault} disabled={clearingVault}>
              {clearingVault ? '清空中...' : '清空 Profile'}
            </button>
          </div>
        </div>

        <ProfileHeader profile={profile} />

        {profile?.summary && (
          <div className="resume-section resume-summary">
            <div className="resume-section-title">
              <span>▣</span>
              <h2>专业摘要</h2>
            </div>
            <p>{profile.summary}</p>
          </div>
        )}

        {loading ? (
          <div className="empty-state">正在加载职业档案...</div>
        ) : resumeSections.length === 0 && !profile?.summary ? (
          <div className="empty-state">左侧输入材料后，AI 会在这里生成像简历一样的职业档案。</div>
        ) : (
          <div className="resume-section-stack">
            {resumeSections.map((section) => (
              <div key={section.section_type} className="resume-section">
                <div className="resume-section-title">
                  <span>▣</span>
                  <h2>{section.section_title}</h2>
                </div>
                <div className="resume-items">
                  {section.events.map((event) => (
                    <ResumeEvent key={event.id} event={event} onEdit={() => openEvent(event)} />
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
            <p>也可以不依赖 AI，直接手动填写工作、项目、教育等类型的条目。</p>
          </div>
        )}
      </section>

      {activeEvent && eventForm && (
        <EventModal
          title="编辑档案条目"
          form={eventForm}
          onChange={setEventForm}
          onClose={() => setActiveEvent(null)}
          onDelete={deleteActiveEvent}
          onSave={saveEvent}
          onConfirm={confirmActiveEvent}
        />
      )}

      {showNewEventModal && (
        <EventModal
          title="手动新增条目"
          form={newEventForm}
          onChange={setNewEventForm}
          onClose={() => setShowNewEventModal(false)}
          onSave={createNewEvent}
          saveLabel="创建条目"
        />
      )}
    </div>
  )
}

function ProfileHeader({ profile }: { profile: ProfileData | null }) {
  const primaryEmail = profile?.emails?.[0]
  const primaryPhone = profile?.phones?.[0]
  const primaryLink = profile?.links?.find((link) => link.url)

  return (
    <div className="resume-hero">
      <div>
        <h2>{profile?.full_name || '你的姓名'}</h2>
        <p>{profile?.headline || '添加材料后，AI 会整理你的职业身份'}</p>
      </div>
      <div className="resume-contact-row">
        {typeof profile?.years_of_experience === 'number' && <span>{profile.years_of_experience} 年经验</span>}
        {primaryEmail && <span>{primaryEmail}</span>}
        {primaryPhone && <span>{primaryPhone}</span>}
        {profile?.location && <span>{profile.location}</span>}
        {primaryLink?.url && <a href={primaryLink.url} target="_blank" rel="noreferrer">{primaryLink.label || '个人链接'}</a>}
      </div>
    </div>
  )
}

function ResumeEvent({ event, onEdit }: { event: VaultEvent; onEdit: () => void }) {
  const sectionType = getLiteSectionType(event)
  const bullets = getBullets(event)
  const skills = getSkills(event)
  const techStack = getTechStack(event)
  const details = event.details_json || {}
  const dateRange = joinDateRange(event.time_start, event.time_end)
  const chips = sectionType === 'projects' ? techStack : skills

  return (
    <article className={`resume-item resume-item-${sectionType}`}>
      <button className="resume-edit-btn" onClick={onEdit} aria-label={`编辑${event.title}`}>✎</button>
      <div className="resume-item-head">
        <div>
          <h3>{event.title}</h3>
          <p>{[event.organization, event.role].filter(Boolean).join(' · ')}</p>
        </div>
        {dateRange && <time>{dateRange}</time>}
      </div>
      {event.location && <p className="resume-muted">{event.location}</p>}
      {sectionType === 'education' && (
        <div className="resume-inline">
          {details.field && <span>{details.field}</span>}
          {details.gpa && <span>GPA: {details.gpa}</span>}
          {getStringList(details.honors).map((honor) => <span key={honor}>{honor}</span>)}
        </div>
      )}
      {sectionType === 'research' && (
        <div className="resume-inline">
          {getStringList(details.authors).map((author) => <span key={author}>{author}</span>)}
          {details.url && <a href={String(details.url)} target="_blank" rel="noreferrer">链接</a>}
        </div>
      )}
      {sectionType === 'certifications' && details.url && <a className="resume-link" href={String(details.url)} target="_blank" rel="noreferrer">查看链接</a>}
      {sectionType === 'languages' && details.proficiency && <p className="resume-muted">{String(details.proficiency)}</p>}
      {event.description && <p className="resume-description">{event.description}</p>}
      {bullets.length > 0 && (
        <ul className="resume-bullets">
          {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      )}
      {chips.length > 0 && (
        <div className="resume-chip-row">
          {chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}
      <div className="resume-status-row">
        <span>{STATUS_LABELS[event.status] || event.status}</span>
      </div>
    </article>
  )
}

function EventModal({
  title,
  form,
  onChange,
  onClose,
  onDelete,
  onSave,
  onConfirm,
  saveLabel = '保存修改',
}: {
  title: string
  form: EventForm
  onChange: (form: EventForm) => void
  onClose: () => void
  onDelete?: () => void
  onSave: () => void
  onConfirm?: () => void
  saveLabel?: string
}) {
  const sectionType = getLiteSectionType({
    id: '',
    event_type: form.event_type,
    title: form.title,
    status: form.status,
    visibility: form.visibility,
    details_json: {},
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="event-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{getLiteSectionTitle(sectionType)}</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        <div className="modal-grid">
          <label>类型<select value={form.event_type} onChange={(event) => onChange({ ...form, event_type: event.target.value })}>{EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>标题<input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} /></label>
          {sectionType !== 'education' && sectionType !== 'languages' && <label>角色<input value={form.role} onChange={(event) => onChange({ ...form, role: event.target.value })} /></label>}
          <label>{sectionType === 'education' ? '学校' : sectionType === 'projects' ? '组织/上下文' : '机构/公司'}<input value={form.organization} onChange={(event) => onChange({ ...form, organization: event.target.value })} /></label>
          <label>开始时间<input value={form.time_start} onChange={(event) => onChange({ ...form, time_start: event.target.value })} /></label>
          <label>结束时间<input value={form.time_end} onChange={(event) => onChange({ ...form, time_end: event.target.value })} /></label>
          {sectionType === 'experience' && <label>地点<input value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} /></label>}
          {sectionType === 'education' && <label>专业<input value={form.field} onChange={(event) => onChange({ ...form, field: event.target.value })} /></label>}
          {sectionType === 'education' && <label>GPA<input value={form.gpa} onChange={(event) => onChange({ ...form, gpa: event.target.value })} /></label>}
          {sectionType === 'languages' && <label>熟练度<input value={form.proficiency} onChange={(event) => onChange({ ...form, proficiency: event.target.value })} /></label>}
          {(sectionType === 'projects' || sectionType === 'certifications' || sectionType === 'research') && <label>链接<input value={form.url} onChange={(event) => onChange({ ...form, url: event.target.value })} /></label>}
          {sectionType === 'projects' && <label>技术栈<input value={form.tech_stack_text} onChange={(event) => onChange({ ...form, tech_stack_text: event.target.value })} placeholder="Python，FastAPI，LangGraph" /></label>}
          {sectionType === 'experience' && <label>技能<input value={form.skills_text} onChange={(event) => onChange({ ...form, skills_text: event.target.value })} placeholder="LLM Agent，Tool Calling" /></label>}
          {sectionType === 'education' && <label>荣誉<input value={form.honors_text} onChange={(event) => onChange({ ...form, honors_text: event.target.value })} /></label>}
          {sectionType === 'research' && <label>作者/发明人<input value={form.authors_text} onChange={(event) => onChange({ ...form, authors_text: event.target.value })} /></label>}
        </div>

        {(sectionType === 'experience' || sectionType === 'projects') && (
          <label className="modal-field">
            要点列表
            <textarea
              value={form.bullets_text}
              onChange={(event) => onChange({ ...form, bullets_text: event.target.value })}
              placeholder="每行一条简历 bullet"
            />
          </label>
        )}

        <label className="modal-field">
          描述
          <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
        </label>

        <div className="modal-actions">
          {onDelete && <button onClick={onDelete} className="danger">删除条目</button>}
          <button onClick={onSave} className="primary">{saveLabel}</button>
          {onConfirm && <button onClick={onConfirm}>确认入库</button>}
        </div>
      </div>
    </div>
  )
}
