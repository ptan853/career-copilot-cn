import type { VaultEvent, VaultSection } from './api-client'

export const PROFILE_SECTION_ORDER = [
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'awards',
  'certifications',
  'research',
  'other',
  'languages',
]

export const SECTION_LABELS: Record<string, string> = {
  summary: '专业摘要',
  experience: '工作/实习',
  projects: '项目',
  education: '教育',
  skills: '技能',
  awards: '奖项',
  certifications: '证书/课程',
  research: '论文/专利',
  other: '志愿/社团/其他',
  languages: '语言',
}

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
  course: 'certifications',
  publication: 'research',
  patent: 'research',
  volunteer: 'other',
  custom: 'other',
  language: 'languages',
}

export function getLiteSectionType(event: VaultEvent) {
  const detailsSection = typeof event.details_json?.section_type === 'string' ? event.details_json.section_type : ''
  return detailsSection || EVENT_TYPE_TO_SECTION[event.event_type] || 'other'
}

export function getLiteSectionTitle(sectionType: string) {
  return SECTION_LABELS[sectionType] || '其他'
}

export function sortVaultSections(sections: VaultSection[]) {
  return [...sections].sort((left, right) => {
    const leftType = left.section_type
    const rightType = right.section_type
    const leftIndex = PROFILE_SECTION_ORDER.indexOf(leftType)
    const rightIndex = PROFILE_SECTION_ORDER.indexOf(rightType)
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
  })
}

export function getStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function getBullets(event: VaultEvent) {
  return getStringList(event.details_json?.bullets)
}

export function getSkills(event: VaultEvent) {
  return getStringList(event.details_json?.skills)
}

export function getTechStack(event: VaultEvent) {
  return getStringList(event.details_json?.tech_stack)
}

export function joinDateRange(start?: string | null, end?: string | null) {
  if (start && end) return `${start} - ${end}`
  if (start) return `${start} - 至今`
  if (end) return end
  return ''
}

export function splitMultilineList(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
}
