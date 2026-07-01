'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Award,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  GraduationCap,
  Languages,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Medal,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ScrollText,
  Sparkles,
  Trash2,
} from 'lucide-react'
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
  updateProfile,
  type VaultEvent,
  type VaultPendingPatch,
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

const EVENT_TYPE_TO_SECTION: Record<string, string> = {
  work: 'experience',
  internship: 'experience',
  project: 'projects',
  startup: 'projects',
  open_source: 'projects',
  education: 'education',
  award: 'awards',
  competition: 'awards',
  certification: 'certifications',
  course: 'courses',
  publication: 'research',
  patent: 'research',
  volunteer: 'other',
  language: 'languages',
  custom: 'other',
}

const SECTION_ICON_MAP = {
  summary: ScrollText,
  experience: BriefcaseBusiness,
  projects: Code2,
  education: GraduationCap,
  skills: Sparkles,
  awards: Award,
  courses: BookOpenCheck,
  certifications: BookOpenCheck,
  research: ScrollText,
  other: Medal,
  languages: Languages,
}

const SECTION_DEFAULT_EVENT_TYPE: Record<string, string> = {
  experience: 'work',
  projects: 'project',
  education: 'education',
  skills: 'custom',
  awards: 'award',
  courses: 'course',
  certifications: 'certification',
  research: 'publication',
  other: 'custom',
  languages: 'language',
}

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
  status: 'selected' | 'uploading' | 'parsing' | 'failed'
  sourceId?: string
  error?: string
}

type ProfileData = {
  full_name?: string | null
  headline?: string | null
  emails?: string[]
  phones?: string[]
  location?: string | null
  links?: ProfileLinkForm[]
  summary?: string | null
  years_of_experience?: number | null
}

type ProfileLinkForm = {
  label?: string
  url?: string
  link_type?: string
  show_in_materials?: boolean
  use_for_ai_parsing?: boolean
}

type ProfileForm = {
  full_name: string
  headline: string
  email: string
  phone: string
  location: string
  links: ProfileLinkForm[]
  years_of_experience: string
}

type EventForm = {
  section_type: string
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

type PatchDecision = 'accepted' | 'rejected'

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  return createPortal(children, document.body)
}

function eventToForm(event: VaultEvent): EventForm {
  const details = { ...EMPTY_DETAILS, ...(event.details_json || {}) }
  const safeTags = Array.isArray(event.tags) ? event.tags : (typeof event.tags === 'string' ? (event.tags as string).split(/[，,]/).map((tag: string) => tag.trim()).filter(Boolean) : [])
  return {
    section_type: getLiteSectionType(event),
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
    tags_text: safeTags.join('，'),
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

function applyPendingPatchToForm(form: EventForm, patch: VaultPendingPatch): EventForm {
  const after = patch.after || {}
  const details = (after.details || after.details_json || {}) as Record<string, any>
  return {
    ...form,
    title: typeof after.title === 'string' ? after.title : form.title,
    role: typeof after.role === 'string' ? after.role : form.role,
    organization: typeof after.organization === 'string' ? after.organization : form.organization,
    location: typeof after.location === 'string' ? after.location : form.location,
    time_start: typeof after.time_start === 'string' ? after.time_start : form.time_start,
    time_end: typeof after.time_end === 'string' ? after.time_end : form.time_end,
    description: typeof after.description === 'string' ? after.description : form.description,
    tags_text: Array.isArray(after.tags) ? after.tags.map(String).join('，') : form.tags_text,
    bullets_text: Array.isArray(details.bullets) ? details.bullets.map(String).join('\n') : form.bullets_text,
    skills_text: Array.isArray(details.skills) ? details.skills.map(String).join('，') : form.skills_text,
    tech_stack_text: Array.isArray(details.tech_stack) ? details.tech_stack.map(String).join('，') : form.tech_stack_text,
    honors_text: Array.isArray(details.honors) ? details.honors.map(String).join('，') : form.honors_text,
    authors_text: Array.isArray(details.authors) ? details.authors.map(String).join('，') : form.authors_text,
    url: typeof details.url === 'string' ? details.url : form.url,
    field: typeof details.field === 'string' ? details.field : form.field,
    gpa: typeof details.gpa === 'string' ? details.gpa : form.gpa,
    proficiency: typeof details.proficiency === 'string' ? details.proficiency : form.proficiency,
  }
}

function emptyEventForm(eventType = 'work'): EventForm {
  const sectionType = EVENT_TYPE_TO_SECTION[eventType] || 'other'
  return {
    section_type: sectionType,
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

function emptyEventFormForSection(sectionType: string): EventForm {
  const eventType = SECTION_DEFAULT_EVENT_TYPE[sectionType] || 'custom'
  return {
    ...emptyEventForm(eventType),
    section_type: sectionType,
  }
}

function profileToForm(profile: ProfileData | null): ProfileForm {
  return {
    full_name: profile?.full_name || '',
    headline: profile?.headline || '',
    email: profile?.emails?.[0] || '',
    phone: profile?.phones?.[0] || '',
    location: profile?.location || '',
    links: Array.isArray(profile?.links) ? profile.links : [],
    years_of_experience: typeof profile?.years_of_experience === 'number' ? String(profile.years_of_experience) : '',
  }
}

function profilePayloadFromForm(form: ProfileForm) {
  const years = Number.parseInt(form.years_of_experience, 10)
  const links = form.links
    .map((link) => ({
      ...link,
      label: String(link.label || '').trim() || '个人链接',
      url: String(link.url || '').trim(),
    }))
    .filter((link) => link.url)

  return {
    full_name: form.full_name.trim() || null,
    headline: form.headline.trim() || null,
    emails: form.email.trim() ? [form.email.trim()] : [],
    phones: form.phone.trim() ? [form.phone.trim()] : [],
    location: form.location.trim() || null,
    links,
    years_of_experience: Number.isFinite(years) ? years : null,
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

  if (form.section_type) details.section_type = form.section_type
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

function isSourceParsing(source: SourceItem) {
  return source.parse_status !== 'parsed' && source.parse_status !== 'failed'
}

function hasParsingSources(sources: SourceItem[]) {
  return sources.some(isSourceParsing)
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

function SectionTitle({ sectionType, title }: { sectionType: string; title: string }) {
  const Icon = SECTION_ICON_MAP[sectionType as keyof typeof SECTION_ICON_MAP] || ScrollText
  return (
    <div className="resume-section-title">
      <span aria-hidden="true"><Icon size={22} /></span>
      <h2>{title}</h2>
    </div>
  )
}

export default function VaultPage() {
  const [text, setText] = useState('')
  const [urls, setUrls] = useState('')
  const [inputHint, setInputHint] = useState('')
  const [fileUploading, setFileUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [isWaitingForParse, setIsWaitingForParse] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [sources, setSources] = useState<SourceItem[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sections, setSections] = useState<VaultSection[]>([])
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>(profileToForm(null))
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeEvent, setActiveEvent] = useState<VaultEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm | null>(null)
  const [patchDecisions, setPatchDecisions] = useState<Record<string, PatchDecision>>({})
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [showProfileActionsMenu, setShowProfileActionsMenu] = useState(false)
  const [clearingVault, setClearingVault] = useState(false)
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [newEventForm, setNewEventForm] = useState<EventForm>(emptyEventForm())
  const fileRef = useRef<HTMLInputElement>(null)
  const profileActionMenuRef = useRef<HTMLDivElement>(null)
  const submittedTextRef = useRef<{ text: string; urls: string; inputHint: string } | null>(null)

  const resumeSections = useMemo(() => groupForResume(sections), [sections])
  const pendingConfirmEvents = useMemo(
    () => resumeSections.flatMap((section) => section.events).filter((event) => event.status === 'draft' || event.status === 'needs_review'),
    [resumeSections],
  )
  const pendingSourceIds = useMemo(
    () => new Set(pendingFiles.map((item) => item.sourceId).filter(Boolean)),
    [pendingFiles],
  )
  const visibleSources = useMemo(
    () => sources.filter((source) => !pendingSourceIds.has(source.id)),
    [sources, pendingSourceIds],
  )

  async function loadProfile() {
    try {
      const response: any = await getProfile()
      setProfile(response.data || null)
    } catch {
      setProfile(null)
    }
  }

  async function loadSections(options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? true
    if (showLoading) setLoading(true)
    try {
      const response = await getGroupedEvents()
      setSections(response.data || [])
    } catch {
      if (showLoading) setStatusMessage('职业档案加载失败，请确认已登录')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function loadSources(options: { showLoading?: boolean } = {}): Promise<SourceItem[] | null> {
    const showLoading = options.showLoading ?? true
    if (showLoading) setSourcesLoading(true)
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
      return hydrated
    } catch {
      if (showLoading) setStatusMessage('源材料加载失败，请确认已登录')
      return null
    } finally {
      if (showLoading) setSourcesLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
    loadSections()
    loadSources()
  }, [])

  useEffect(() => {
    if (!isWaitingForParse) return
    let cancelled = false

    async function refreshUntilDone() {
      const latestSources = await loadSources({ showLoading: false })
      await loadSections({ showLoading: false })
      if (latestSources) {
        setPendingFiles((current) =>
          current.flatMap((item) => {
            if (!item.sourceId || item.status !== 'parsing') return [item]
            const source = latestSources.find((candidate) => candidate.id === item.sourceId)
            if (!source) return [item]
            if (source.parse_status === 'parsed') return []
            if (source.parse_status === 'failed') {
              return [{
                ...item,
                status: 'failed' as const,
                error: source.parse_error || 'AI 解析失败，可以修改设置后重试',
              }]
            }
            return [item]
          }),
        )
      }
      if (!cancelled && latestSources && !hasParsingSources(latestSources)) {
        setIsWaitingForParse(false)
        if (latestSources.some((source) => source.parse_status === 'failed')) {
          setStatusMessage('部分材料解析失败，原输入已保留，可以修改后重新尝试。')
        } else {
          const submittedText = submittedTextRef.current
          if (submittedText) {
            setText((current) => current === submittedText.text ? '' : current)
            setUrls((current) => current === submittedText.urls ? '' : current)
            setInputHint((current) => current === submittedText.inputHint ? '' : current)
          }
          setStatusMessage('解析完成，职业档案已更新')
        }
        submittedTextRef.current = null
      }
    }

    refreshUntilDone()
    const parseTimer = window.setInterval(refreshUntilDone, 4000)
    return () => {
      cancelled = true
      window.clearInterval(parseTimer)
    }
  }, [isWaitingForParse])

  useEffect(() => {
    if (!showProfileActionsMenu) return

    function handlePointerDown(event: PointerEvent) {
      if (!profileActionMenuRef.current?.contains(event.target as Node)) {
        setShowProfileActionsMenu(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowProfileActionsMenu(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showProfileActionsMenu])

  async function submitTextSource(options: { silent?: boolean; preserveInputsOnSuccess?: boolean } = {}): Promise<boolean> {
    const cleanText = text.trim()
    const cleanUrls = urls.split('\n').map((url) => url.trim()).filter((url) => url.startsWith('http'))
    if (!cleanText && cleanUrls.length === 0) {
      if (!options.silent) setStatusMessage('请先输入文字或链接')
      return false
    }
    setSubmitting(true)
    if (!options.silent) setStatusMessage('正在创建解析任务...')
    try {
      await createSource({ text: cleanText, urls: cleanUrls, input_hint: inputHint.trim() })
      if (!options.preserveInputsOnSuccess) {
        setText('')
        setUrls('')
        setInputHint('')
      }
      if (!options.silent) {
        setStatusMessage('已提交，解析完成后会出现在右侧')
        setIsWaitingForParse(true)
        await loadSources()
        await loadSections()
      }
      return true
    } catch {
      setStatusMessage('提交失败，请检查登录状态或 API 设置')
      return false
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
    let submittedCount = 0
    try {
      if (pendingFiles.length) {
        for (const item of pendingFiles) {
          if (item.status === 'parsing' || item.status === 'uploading') continue
          setPendingFiles((current) =>
            current.map((fileItem) => fileItem.id === item.id ? { ...fileItem, status: 'uploading', error: undefined } : fileItem),
          )
          try {
            if (item.sourceId) {
              try {
                await deleteSource(item.sourceId)
              } catch {
                // Best effort cleanup; the new upload should still proceed.
              }
            }
            const response: any = await uploadSourceFile(item.file)
            submittedCount += 1
            setPendingFiles((current) =>
              current.map((fileItem) =>
                fileItem.id === item.id
                  ? { ...fileItem, status: 'parsing', sourceId: response.source_id, error: undefined }
                  : fileItem,
              ),
            )
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
        const textSnapshot = { text, urls, inputHint }
        const submittedText = await submitTextSource({ silent: true, preserveInputsOnSuccess: true })
        if (submittedText) submittedCount += 1
        if (submittedText) submittedTextRef.current = textSnapshot
      }

      if (submittedCount > 0) {
        setStatusMessage('材料已提交，正在等待 AI 解析完成。')
        setIsWaitingForParse(true)
        await loadSources({ showLoading: false })
        await loadSections({ showLoading: false })
      } else {
        setStatusMessage('没有成功提交的材料，请检查失败信息后重试。')
      }
    } catch (error: any) {
      setStatusMessage(error?.message || '解析失败')
    } finally {
      setFileUploading(false)
    }
  }

  async function removePendingFile(id: string) {
    const item = pendingFiles.find((candidate) => candidate.id === id)
    setPendingFiles((current) => current.filter((candidate) => candidate.id !== id))
    if (item?.sourceId) {
      try {
        await deleteSource(item.sourceId)
        await loadSources({ showLoading: false })
      } catch {
        setStatusMessage('文件已移除，但后端材料记录删除失败')
      }
    }
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
    if (!window.confirm('这将清空右侧职业档案中的经历条目、证据和左侧材料记录；不会删除账号、API Key、个人资料和模型配置。此操作不可恢复。')) return
    setClearingVault(true)
    try {
      await clearVault()
      setPendingFiles([])
      setSources([])
      setSections([])
      setActiveEvent(null)
      setEventForm(null)
      setStatusMessage('职业档案内容已清空')
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
    try {
      const form = eventToForm(event)
      setActiveEvent(event)
      setEventForm(form)
      setPatchDecisions({})
    } catch (error) {
      console.error('Failed to open event for editing:', error)
      setStatusMessage('无法打开编辑框，数据格式可能有问题，请刷新后重试。')
    }
  }

  function closeEventModal() {
    setActiveEvent(null)
    setEventForm(null)
    setPatchDecisions({})
  }

  function acceptPendingPatch(patch: VaultPendingPatch) {
    setEventForm((current) => current ? applyPendingPatchToForm(current, patch) : current)
    setPatchDecisions((current) => ({ ...current, [patch.id]: 'accepted' }))
    setStatusMessage('更新已应用到编辑表单，保存后正式入库。')
  }

  function rejectPendingPatch(patch: VaultPendingPatch) {
    setPatchDecisions((current) => ({ ...current, [patch.id]: 'rejected' }))
    setStatusMessage('已忽略这次更新，保存后会标记为不合并。')
  }

  function openProfileEditor() {
    setProfileForm(profileToForm(profile))
    setShowProfileModal(true)
  }

  function openNewEventForSection(sectionType: string) {
    setNewEventForm(emptyEventFormForSection(sectionType))
    setShowNewEventModal(true)
  }

  async function saveProfile() {
    try {
      const response: any = await updateProfile(profilePayloadFromForm(profileForm))
      setProfile(response.data || null)
      setShowProfileModal(false)
      setStatusMessage('个人资料已保存')
    } catch (error: any) {
      setStatusMessage(error?.message || '个人资料保存失败')
    }
  }

  async function saveEvent() {
    if (!activeEvent || !eventForm) return
    const patchUpdates = Object.entries(patchDecisions).map(([id, status]) => ({ id, status }))
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
      ...(patchUpdates.length ? { patch_updates: patchUpdates } : {}),
    })
    setStatusMessage('已保存')
    setPatchDecisions({})
    await loadSections()
  }

  async function confirmActiveEvent() {
    if (!activeEvent) return
    await confirmEvent(activeEvent.id)
    setActiveEvent(null)
    setEventForm(null)
    await loadSections()
  }

  async function confirmAllEvents() {
    if (!pendingConfirmEvents.length) return
    if (!window.confirm(`确定确认当前 ${pendingConfirmEvents.length} 条待确认档案条目？`)) return
    setConfirmingAll(true)
    try {
      await Promise.all(pendingConfirmEvents.map((event) => confirmEvent(event.id)))
      setStatusMessage(`已确认 ${pendingConfirmEvents.length} 条档案条目`)
      await loadSections()
    } catch (error: any) {
      setStatusMessage(error?.message || '批量确认失败，请稍后重试')
    } finally {
      setConfirmingAll(false)
    }
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
        {statusMessage && <p className="status-message">{statusMessage}</p>}

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

        {pendingFiles.length > 0 && (
          <div className="material-list">
            {pendingFiles.map((item, index) => (
              <div key={item.id} className={`material-row ${item.status === 'failed' ? 'failed' : ''}`}>
                <span className="material-index">{index + 1}</span>
                <div className="material-main">
                  <strong>{item.file.name}</strong>
                  <span>{formatFileSize(item.file.size)} · {item.status === 'uploading' ? '上传中' : item.status === 'parsing' ? 'AI 解析中' : item.status === 'failed' ? item.error || '上传失败' : '待解析'}</span>
                </div>
                <button type="button" onClick={() => removePendingFile(item.id)} disabled={item.status === 'uploading' || item.status === 'parsing'} aria-label="删除文件">
                  ×
                </button>
              </div>
            ))}

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

        <button className="submit-source" onClick={analyzePendingFiles} disabled={submitting || fileUploading || isWaitingForParse}>
          {(submitting || fileUploading || isWaitingForParse) && <Loader2 size={17} className="spin-icon" />}
          {submitting || fileUploading || isWaitingForParse ? '解析中...' : '开始解析'}
        </button>

        <div className="source-list">
          <div className="source-list-heading">
            <h2>已解析内容</h2>
            <button type="button" onClick={() => loadSources()}>刷新</button>
          </div>
          {sourcesLoading ? (
            <p className="source-list-empty">正在加载材料...</p>
          ) : visibleSources.length === 0 ? (
            <p className="source-list-empty">解析完成后，会在这里展示提取出的文本内容。</p>
          ) : (
            <div className="source-list-stack">
              {visibleSources.slice(0, 6).map((source) => (
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
                  <button type="button" onClick={() => removeSource(source)} aria-label="删除材料">
                    ×
                  </button>
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
            <button
              className="icon"
              onClick={() => { loadProfile(); loadSections() }}
              aria-label="刷新职业档案"
              title="刷新职业档案"
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="confirm"
              onClick={confirmAllEvents}
              disabled={loading || confirmingAll || pendingConfirmEvents.length === 0}
            >
              <CheckCircle2 size={17} />
              {confirmingAll ? '确认中...' : `确认全部${pendingConfirmEvents.length ? ` ${pendingConfirmEvents.length}` : ''}`}
            </button>
            <div className="profile-action-menu" ref={profileActionMenuRef}>
              <button
                className="icon"
                onClick={() => setShowProfileActionsMenu((current) => !current)}
                aria-expanded={showProfileActionsMenu}
                aria-label="更多操作"
                title="更多操作"
              >
                <MoreHorizontal size={18} />
              </button>
              {showProfileActionsMenu && (
                <div className="profile-action-popover">
                  <button
                    className="danger"
                    onClick={() => {
                      setShowProfileActionsMenu(false)
                      clearCurrentVault()
                    }}
                    disabled={clearingVault}
                  >
                    <Trash2 size={15} />
                    {clearingVault ? '清空中...' : '清空档案内容'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <ProfileHeader profile={profile} onEdit={openProfileEditor} />

        {profile?.summary && (
          <div className="resume-section resume-summary">
            <SectionTitle sectionType="summary" title="专业摘要" />
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
                <div className="resume-section-head">
                  <SectionTitle sectionType={section.section_type} title={section.section_title} />
                  <button type="button" onClick={() => openNewEventForSection(section.section_type)}>
                    <Plus size={16} />
                    新增条目
                  </button>
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
            <button className="manual-add-btn" onClick={() => {
              setNewEventForm(emptyEventForm())
              setShowNewEventModal(true)
            }}>
              手动新增条目
            </button>
            <p>如果要添加某个 section 内的新内容，可以直接用 section 右上角的“新增条目”。</p>
          </div>
        )}
      </section>

      {activeEvent && eventForm && (
        <EventModal
          title="编辑档案条目"
          form={eventForm}
          pendingPatches={activeEvent.pending_patches || []}
          patchDecisions={patchDecisions}
          onChange={setEventForm}
          onClose={closeEventModal}
          onDelete={deleteActiveEvent}
          onSave={saveEvent}
          onConfirm={activeEvent.status === 'confirmed' ? undefined : confirmActiveEvent}
          onAcceptPatch={acceptPendingPatch}
          onRejectPatch={rejectPendingPatch}
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

      {showProfileModal && (
        <ProfileModal
          form={profileForm}
          onChange={setProfileForm}
          onClose={() => setShowProfileModal(false)}
          onSave={saveProfile}
        />
      )}
    </div>
  )
}

function ProfileHeader({ profile, onEdit }: { profile: ProfileData | null; onEdit: () => void }) {
  const primaryEmail = profile?.emails?.[0]
  const primaryPhone = profile?.phones?.[0]
  const links = (profile?.links || []).filter((link) => link.url)

  return (
    <div className="resume-hero">
      <button className="resume-hero-edit" onClick={onEdit} aria-label="编辑个人资料">
        <Pencil size={18} />
      </button>
      <div>
        <h2>{profile?.full_name || '你的姓名'}</h2>
        <p>{profile?.headline || '添加材料后，AI 会整理你的职业身份'}</p>
      </div>
      <div className="resume-contact-row">
        {typeof profile?.years_of_experience === 'number' && (
          <span>
            <BriefcaseBusiness size={17} />
            {profile.years_of_experience} 年经验
          </span>
        )}
        {primaryEmail && (
          <span>
            <Mail size={17} />
            {primaryEmail}
          </span>
        )}
        {primaryPhone && (
          <span>
            <Phone size={17} />
            {primaryPhone}
          </span>
        )}
        {profile?.location && (
          <span>
            <MapPin size={17} />
            {profile.location}
          </span>
        )}
        {links.map((link) => (
          <a key={`${link.label || 'link'}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
            <Link2 size={17} />
            {link.label || '个人链接'}
          </a>
        ))}
      </div>
    </div>
  )
}

function ProfileModal({
  form,
  onChange,
  onClose,
  onSave,
}: {
  form: ProfileForm
  onChange: (form: ProfileForm) => void
  onClose: () => void
  onSave: () => void
}) {
  const updateLink = (index: number, patch: Partial<ProfileLinkForm>) => {
    const links = [...form.links]
    links[index] = { ...links[index], ...patch }
    onChange({ ...form, links })
  }

  const addLink = () => {
    onChange({ ...form, links: [...form.links, { label: '个人链接', url: '', show_in_materials: true }] })
  }

  const removeLink = (index: number) => {
    onChange({ ...form, links: form.links.filter((_, itemIndex) => itemIndex !== index) })
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
      <div className="event-modal profile-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">个人资料</p>
            <h2>编辑 Profile</h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        <div className="modal-grid">
          <label>姓名<input value={form.full_name} onChange={(event) => onChange({ ...form, full_name: event.target.value })} /></label>
          <label>职业标题<input value={form.headline} onChange={(event) => onChange({ ...form, headline: event.target.value })} placeholder="例如：Agent 算法工程师" /></label>
          <label>邮箱<input value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} /></label>
          <label>电话<input value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} /></label>
          <label>地点<input value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} /></label>
          <label>工作年限<input value={form.years_of_experience} onChange={(event) => onChange({ ...form, years_of_experience: event.target.value })} placeholder="例如：1" /></label>
        </div>

        <div className="profile-link-editor">
          <div className="profile-link-editor-head">
            <h3>个人链接</h3>
            <button type="button" onClick={addLink}>添加链接</button>
          </div>
          {form.links.length === 0 ? (
            <p className="form-empty-hint">还没有链接，可以添加 GitHub、作品集、LinkedIn 或个人网站。</p>
          ) : (
            <div className="profile-link-list">
              {form.links.map((link, index) => (
                <div className="profile-link-row" key={`profile-link-${index}`}>
                  <input
                    value={link.label || ''}
                    onChange={(event) => updateLink(index, { label: event.target.value })}
                    placeholder="GitHub / 作品集"
                  />
                  <input
                    value={link.url || ''}
                    onChange={(event) => updateLink(index, { url: event.target.value })}
                    placeholder="https://..."
                  />
                  <button type="button" onClick={() => removeLink(index)} aria-label="删除链接">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button onClick={onSave} className="primary">保存资料</button>
        </div>
      </div>
      </div>
    </ModalPortal>
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
  const pendingUpdateCount = event.pending_patch_count || event.pending_patches?.length || 0

  if (sectionType === 'courses') {
    return (
      <article className="resume-course-row">
        <div>
          <strong>{event.title}</strong>
          {event.organization && <span> — {event.organization}</span>}
          {pendingUpdateCount > 0 && <em className="resume-update-pill">有更新 {pendingUpdateCount}</em>}
        </div>
        <div className="resume-course-meta">
          {dateRange && <time>{dateRange}</time>}
          <button className="resume-edit-btn" onClick={onEdit} aria-label={`编辑${event.title}`}>
            <Pencil size={17} />
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className={`resume-item resume-item-${sectionType}`}>
      <button className="resume-edit-btn" onClick={onEdit} aria-label={`编辑${event.title}`}>
        <Pencil size={17} />
      </button>
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
        <span className={`status-${event.status}`}>{STATUS_LABELS[event.status] || event.status}</span>
        {pendingUpdateCount > 0 && <span className="status-update">有更新 {pendingUpdateCount}</span>}
      </div>
    </article>
  )
}

const PATCH_FIELD_LABELS: Record<string, string> = {
  title: '标题',
  role: '角色',
  organization: '机构/公司',
  location: '地点',
  time_start: '开始时间',
  time_end: '结束时间',
  description: '描述',
  tags: '标签',
  'details.bullets': '简历要点',
  'details.skills': '技能',
  'details.tech_stack': '技术栈',
  'details.honors': '荣誉',
  'details.authors': '作者/发明人',
  'details.url': '链接',
  'details.field': '专业/方向',
  'details.gpa': 'GPA',
  'details.proficiency': '熟练度',
}

function PendingPatchPanel({
  patches,
  decisions,
  onAccept,
  onReject,
}: {
  patches: VaultPendingPatch[]
  decisions: Record<string, PatchDecision>
  onAccept?: (patch: VaultPendingPatch) => void
  onReject?: (patch: VaultPendingPatch) => void
}) {
  return (
    <div className="pending-patch-panel">
      <div className="pending-patch-head">
        <div>
          <span>AI 发现这些内容可能是已有条目的更新</span>
          <strong>接受后会先写入下方表单，点击保存才正式入库。</strong>
        </div>
      </div>
      <div className="pending-patch-list">
        {patches.map((patch) => {
          const decision = decisions[patch.id]
          return (
            <div className={`pending-patch-card ${decision ? `is-${decision}` : ''}`} key={patch.id}>
              <div className="pending-patch-card-head">
                <div>
                  <strong>{patch.reason || '补充已有经历'}</strong>
                  <span>{patch.diff?.length || 0} 处变化</span>
                </div>
                <div className="pending-patch-actions">
                  {decision && <em>{decision === 'accepted' ? '已应用到表单' : '已忽略'}</em>}
                  <button type="button" disabled={decision === 'accepted'} onClick={() => onAccept?.(patch)}>接受更新</button>
                  <button type="button" disabled={decision === 'rejected'} onClick={() => onReject?.(patch)}>忽略</button>
                </div>
              </div>
              <div className="pending-patch-diff">
                {(patch.diff || []).slice(0, 8).map((diff, index) => (
                  <div className="pending-patch-diff-row" key={`${patch.id}-${diff.field}-${index}`}>
                    <span>{PATCH_FIELD_LABELS[diff.field] || diff.field}</span>
                    <div>
                      {diff.change_type === 'add' ? (
                        <p><b>新增</b>{formatPatchValue(diff.new_value)}</p>
                      ) : diff.change_type === 'remove' ? (
                        <p><b>删除</b>{formatPatchValue(diff.old_value)}</p>
                      ) : (
                        <>
                          <p><b>原来</b>{formatPatchValue(diff.old_value)}</p>
                          <p><b>更新为</b>{formatPatchValue(diff.new_value)}</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatPatchValue(value: any) {
  if (value === null || typeof value === 'undefined' || value === '') return '空'
  if (Array.isArray(value)) return value.map(String).join('；')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function EventModal({
  title,
  form,
  pendingPatches = [],
  patchDecisions = {},
  onChange,
  onClose,
  onDelete,
  onSave,
  onConfirm,
  onAcceptPatch,
  onRejectPatch,
  saveLabel = '保存修改',
}: {
  title: string
  form: EventForm
  pendingPatches?: VaultPendingPatch[]
  patchDecisions?: Record<string, PatchDecision>
  onChange: (form: EventForm) => void
  onClose: () => void
  onDelete?: () => void
  onSave: () => void
  onConfirm?: () => void
  onAcceptPatch?: (patch: VaultPendingPatch) => void
  onRejectPatch?: (patch: VaultPendingPatch) => void
  saveLabel?: string
}) {
  const sectionType = getLiteSectionType({
    id: '',
    event_type: form.event_type,
    title: form.title,
    status: form.status,
    visibility: form.visibility,
    details_json: { section_type: form.section_type },
  })
  const bulletLines = form.bullets_text ? form.bullets_text.split('\n') : []
  const showBullets = sectionType === 'experience' || sectionType === 'projects'
  const showTypeSelector = sectionType !== 'skills'
  const showRole = sectionType === 'experience' || sectionType === 'projects' || sectionType === 'other'
  const showOrganization = sectionType !== 'skills' && sectionType !== 'languages'
  const showDateRange = sectionType === 'experience' || sectionType === 'projects' || sectionType === 'other'
  const showSingleDate = sectionType === 'education' || sectionType === 'awards' || sectionType === 'courses' || sectionType === 'certifications' || sectionType === 'research'
  const showDescription = sectionType !== 'skills' && sectionType !== 'languages'
  const organizationLabel =
    sectionType === 'education' ? '学校'
      : sectionType === 'projects' ? '组织/上下文'
        : sectionType === 'awards' ? '颁发方'
          : sectionType === 'courses' ? '机构/平台'
            : sectionType === 'certifications' ? '机构'
            : sectionType === 'research' ? '发表/授权方'
              : '机构/公司'

  const updateBullet = (index: number, value: string) => {
    const nextBullets = [...bulletLines]
    nextBullets[index] = value
    onChange({ ...form, bullets_text: nextBullets.join('\n') })
  }

  const addBullet = () => {
    onChange({ ...form, bullets_text: [...bulletLines, ''].join('\n') })
  }

  const removeBullet = (index: number) => {
    onChange({ ...form, bullets_text: bulletLines.filter((_, bulletIndex) => bulletIndex !== index).join('\n') })
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop" onClick={onClose}>
      <div className="event-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{getLiteSectionTitle(sectionType)}</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        {pendingPatches.length > 0 && (
          <PendingPatchPanel
            patches={pendingPatches}
            decisions={patchDecisions}
            onAccept={onAcceptPatch}
            onReject={onRejectPatch}
          />
        )}

        <div className="modal-grid">
          {showTypeSelector && <label>类型<select value={form.event_type} onChange={(event) => {
            const eventType = event.target.value
            onChange({ ...form, event_type: eventType, section_type: EVENT_TYPE_TO_SECTION[eventType] || form.section_type })
          }}>{EVENT_TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
          <label>{sectionType === 'skills' ? '技能分类' : sectionType === 'languages' ? '语言' : sectionType === 'education' ? '学位/学历' : '标题'}<input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} /></label>
          {showRole && <label>角色<input value={form.role} onChange={(event) => onChange({ ...form, role: event.target.value })} /></label>}
          {showOrganization && <label>{organizationLabel}<input value={form.organization} onChange={(event) => onChange({ ...form, organization: event.target.value })} /></label>}
          {showDateRange && <label>开始时间<input value={form.time_start} onChange={(event) => onChange({ ...form, time_start: event.target.value })} /></label>}
          {showDateRange && <label>结束时间<input value={form.time_end} onChange={(event) => onChange({ ...form, time_end: event.target.value })} /></label>}
          {showSingleDate && <label>{sectionType === 'education' ? '毕业时间' : '时间/年份'}<input value={form.time_end} onChange={(event) => onChange({ ...form, time_end: event.target.value })} /></label>}
          {sectionType === 'experience' && <label>地点<input value={form.location} onChange={(event) => onChange({ ...form, location: event.target.value })} /></label>}
          {sectionType === 'education' && <label>专业<input value={form.field} onChange={(event) => onChange({ ...form, field: event.target.value })} /></label>}
          {sectionType === 'education' && <label>GPA<input value={form.gpa} onChange={(event) => onChange({ ...form, gpa: event.target.value })} /></label>}
          {sectionType === 'education' && <label>学校期间荣誉<input value={form.honors_text} onChange={(event) => onChange({ ...form, honors_text: event.target.value })} placeholder="奖学金，优秀学生，校内竞赛奖项" /></label>}
          {sectionType === 'languages' && <label>熟练度<input value={form.proficiency} onChange={(event) => onChange({ ...form, proficiency: event.target.value })} /></label>}
          {(sectionType === 'projects' || sectionType === 'courses' || sectionType === 'certifications' || sectionType === 'research') && <label>链接<input value={form.url} onChange={(event) => onChange({ ...form, url: event.target.value })} /></label>}
          {sectionType === 'projects' && <label>技术栈<input value={form.tech_stack_text} onChange={(event) => onChange({ ...form, tech_stack_text: event.target.value })} placeholder="Python，FastAPI，LangGraph" /></label>}
          {(sectionType === 'experience' || sectionType === 'skills') && <label>{sectionType === 'skills' ? '技能' : '技能'}<input value={form.skills_text} onChange={(event) => onChange({ ...form, skills_text: event.target.value })} placeholder="LLM Agent，Tool Calling" /></label>}
          {sectionType === 'research' && <label>作者/发明人<input value={form.authors_text} onChange={(event) => onChange({ ...form, authors_text: event.target.value })} /></label>}
        </div>

        {showBullets && (
          <div className="bullet-editor">
            <div className="bullet-editor-head">
              <span>要点列表</span>
              <button type="button" onClick={addBullet}>添加要点</button>
            </div>
            {(bulletLines.length ? bulletLines : ['']).map((bullet, index) => (
              <div className="bullet-editor-row" key={`bullet-${index}`}>
                <span aria-hidden="true">•</span>
                <textarea
                  value={bullet}
                  onChange={(event) => updateBullet(index, event.target.value)}
                  placeholder="每行一个简历要点"
                />
                <button type="button" onClick={() => removeBullet(index)} aria-label="删除要点">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showDescription && <label className="modal-field">
          描述
          <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
        </label>}

        <div className="modal-actions">
          {onDelete && <button onClick={onDelete} className="danger">删除条目</button>}
          <button onClick={onSave} className="primary">{saveLabel}</button>
          {onConfirm && <button onClick={onConfirm}>确认入库</button>}
        </div>
      </div>
      </div>
    </ModalPortal>
  )
}
