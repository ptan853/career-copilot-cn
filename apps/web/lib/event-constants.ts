// 事件类型 — 颜色映射
export const EVENT_TYPE_COLORS: Record<string, { bar: string; bg: string; label: string }> = {
  work:          { bar: '#2563EB', bg: '#EFF6FF', label: '工作' },
  project:       { bar: '#7C3AED', bg: '#F5F3FF', label: '项目' },
  education:     { bar: '#059669', bg: '#ECFDF5', label: '教育' },
  certification: { bar: '#0891B2', bg: '#ECFEFF', label: '证书' },
  award:         { bar: '#D97706', bg: '#FFFBEB', label: '获奖' },
  publication:   { bar: '#DC2626', bg: '#FEF2F2', label: '发表' },
  open_source:   { bar: '#4F46E5', bg: '#EEF2FF', label: '开源' },
  custom:        { bar: '#6B7280', bg: '#F9FAFB', label: '其他' },
}

export const EVENT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  draft:        { color: '#D97706', bg: '#FEF3C7', label: '待审核' },
  confirmed:    { color: '#059669', bg: '#D1FAE5', label: '已确认' },
  needs_review: { color: '#DC2626', bg: '#FEE2E2', label: '需修改' },
  archived:     { color: '#6B7280', bg: '#F3F4F6', label: '已归档' },
}

export type EventType = keyof typeof EVENT_TYPE_COLORS
export type EventStatus = keyof typeof EVENT_STATUS_CONFIG
