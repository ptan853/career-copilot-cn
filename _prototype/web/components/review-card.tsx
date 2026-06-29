'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { EVENT_TYPE_COLORS, EVENT_STATUS_CONFIG, type EventType, type EventStatus } from '@/lib/event-constants'

export interface EventData {
  id: string
  type: EventType
  title: string
  organization?: string
  role?: string
  time_start?: string
  time_end?: string
  time_precision?: string
  description?: string
  status: EventStatus
  visibility?: string
  tags?: string[]
  details?: Record<string, any>
  created_at?: string
}

interface ReviewCardProps {
  event: EventData
  onConfirm: (id: string) => void
  onArchive: (id: string) => void
  onUpdate: (id: string, field: string, value: string) => void
}

export default function ReviewCard({ event, onConfirm, onArchive, onUpdate }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const typeMeta = EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.custom
  const statusMeta = EVENT_STATUS_CONFIG[event.status] || EVENT_STATUS_CONFIG.draft

  const startEditing = (field: string, current: string) => {
    setEditingField(field)
    setEditValue(current || '')
  }

  const saveEdit = () => {
    if (editingField && editValue !== (getFieldValue(editingField) || '')) {
      onUpdate(event.id, editingField, editValue)
    }
    setEditingField(null)
  }

  const getFieldValue = (field: string): string => {
    const map: Record<string, string> = {
      title: event.title || '',
      organization: event.organization || '',
      role: event.role || '',
      description: event.description || '',
    }
    return map[field] || ''
  }

  const EditableField = ({ field, label, value }: { field: string; label: string; value?: string }) => {
    if (!value && editingField !== field) return null

    if (editingField === field) {
      return (
        <div className="flex items-start gap-2 py-1.5">
          <span className="text-[11px] font-medium text-[#8E9BAE] w-16 shrink-0 mt-1.5">{label}</span>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingField(null) }}
            className="flex-1 px-2 py-1 text-sm border border-[#2563EB] rounded bg-white outline-none"
            autoFocus
          />
        </div>
      )
    }

    return (
      <div
        className="flex items-start gap-2 py-1.5 group cursor-pointer hover:bg-[#F5F7FA] rounded px-0.5 -mx-0.5"
        onClick={() => startEditing(field, value)}
      >
        <span className="text-[11px] font-medium text-[#8E9BAE] w-16 shrink-0 mt-0.5">{label}</span>
        <span className="text-sm text-[#1A1A2E]">{value}</span>
        <span className="opacity-0 group-hover:opacity-100 text-[#8E9BAE] text-xs ml-auto shrink-0">点击编辑</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-[#E5E7EB] overflow-hidden transition-all',
        expanded ? 'shadow-md' : 'shadow-sm hover:shadow'
      )}
    >
      {/* Main row — status bar left */}
      <div className="flex">
        {/* Color bar */}
        <div
          className="w-[3px] shrink-0"
          style={{ backgroundColor: typeMeta.bar }}
        />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-3 flex items-center gap-3 text-left"
          >
            {/* Type tag */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium shrink-0"
              style={{ backgroundColor: typeMeta.bg, color: typeMeta.bar }}
            >
              {typeMeta.label}
            </span>

            {/* Title + org */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A2E] truncate">
                {event.title || '未命名事件'}
              </p>
              {event.organization && (
                <p className="text-xs text-[#5A6A7A] truncate mt-0.5">
                  {event.organization}{event.role ? ` · ${event.role}` : ''}
                </p>
              )}
            </div>

            {/* Time range */}
            {event.time_start && (
              <span className="text-xs text-[#8E9BAE] shrink-0 hidden sm:inline">
                {event.time_start}{event.time_end ? ` — ${event.time_end}` : ''}
              </span>
            )}

            {/* Status badge */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
              style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>

            {/* Chevron */}
            <svg
              className={cn(
                'w-4 h-4 text-[#8E9BAE] shrink-0 transition-transform',
                expanded && 'rotate-180'
              )}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded detail */}
          {expanded && (
            <div className="px-4 pb-4 border-t border-[#F3F4F6] pt-3 space-y-1">
              <EditableField field="title" label="标题" value={event.title} />
              <EditableField field="organization" label="组织" value={event.organization} />
              <EditableField field="role" label="角色" value={event.role} />
              <EditableField field="description" label="描述" value={event.description} />

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {event.tags.map((tag) => (
                    <span key={tag} className="text-[11px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#5A6A7A] rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Details JSON */}
              {event.details && Object.keys(event.details).length > 0 && (
                <details className="pt-1">
                  <summary className="text-[11px] text-[#8E9BAE] cursor-pointer">更多字段</summary>
                  <pre className="text-[11px] text-[#5A6A7A] mt-1 bg-[#F9FAFB] p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-[#F3F4F6] mt-2">
                {event.status === 'draft' && (
                  <button
                    onClick={() => onConfirm(event.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#059669] text-white hover:bg-[#047857] transition-colors"
                  >
                    确认无误
                  </button>
                )}
                {event.status === 'confirmed' && (
                  <button
                    onClick={() => onArchive(event.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#D0D5DD] text-[#5A6A7A] hover:bg-gray-50 transition-colors"
                  >
                    归档
                  </button>
                )}
                {event.status !== 'archived' && (
                  <button
                    onClick={() => onArchive(event.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#D0D5DD] text-[#5A6A7A] hover:bg-gray-50 transition-colors"
                  >
                    {event.status === 'draft' ? '跳过' : '归档'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
