'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, FileText, LibraryBig, PencilLine, Plus, ShieldCheck } from 'lucide-react'
import { getDashboardSummary, getEvents, getSources } from '@/lib/api-client'

type Summary = {
  vault_readiness_pct: number
  source_count: number
  total_events: number
  confirmed_events: number
  draft_events: number
  needs_review: number
  claim_count: number
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sources, setSources] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    getDashboardSummary().then((r: any) => setSummary(r.data)).catch(() => {})
    getSources().then((r: any) => setSources(r.data || [])).catch(() => {})
    getEvents().then((r: any) => setEvents(r.data || [])).catch(() => {})
  }, [])

  const readiness = summary?.vault_readiness_pct ?? 0
  const hasVaultData = Boolean((summary?.source_count || 0) + (summary?.total_events || 0))
  const pendingCount = (summary?.draft_events || 0) + (summary?.needs_review || 0)

  const nextActions = [
    !summary?.source_count && {
      title: '添加第一份源材料',
      desc: '粘贴简历、项目记录、BOSS/拉勾岗位描述，先把资料保存进库。',
      href: '/vault',
    },
    !summary?.total_events && {
      title: '手动整理一条经历',
      desc: '自动解析还没接入前，先用固定字段建立工作、项目、教育或奖项事件。',
      href: '/vault',
    },
    pendingCount > 0 && {
      title: '确认待审核经历',
      desc: `${pendingCount} 条经历还没有确认，确认后才会进入后续材料生成。`,
      href: '/vault',
    },
    summary?.total_events && !pendingCount && {
      title: '继续补充证据细节',
      desc: '为已确认经历补充指标、职责、成果和原始来源。',
      href: '/vault',
    },
  ].filter(Boolean) as Array<{ title: string; desc: string; href: string }>

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-[30px] bg-[#24243f] p-6 text-white shadow-panel lg:p-8">
          <p className="mb-4 inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-extrabold text-white/82">
            职业资料库
          </p>
          <h1 className="max-w-[760px] text-[34px] font-black leading-[1.08] tracking-normal sm:text-[42px]">
            先把经历整理清楚，再让智能体替你完成求职任务
          </h1>
          <p className="mt-4 max-w-[760px] text-sm leading-7 text-white/68">
            当前阶段的工作台只展示真实数据：你保存了哪些材料、整理出多少经历、哪些内容已经确认。岗位匹配和材料生成会在资料库可用后继续接入。
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-4">
            {[
              { label: '源材料', value: summary?.source_count || 0, color: 'bg-[#f8d7aa]' },
              { label: '职业经历', value: summary?.total_events || 0, color: 'bg-[#ddd5ff]' },
              { label: '已确认', value: summary?.confirmed_events || 0, color: 'bg-[#c5efdf]' },
              { label: '待处理', value: pendingCount, color: 'bg-[#f4c4ca]' },
            ].map((m) => (
              <div key={m.label} className={`${m.color} rounded-[24px] p-4 text-app-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,.45)]`}>
                <p className="text-[30px] font-black leading-none">{m.value}</p>
                <p className="mt-7 text-xs font-extrabold text-app-ink/62">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="app-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-app-muted">档案就绪度</p>
              <h2 className="mt-1 text-3xl font-black">{readiness}%</h2>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[#e7f7ef] text-app-green">
              <ShieldCheck size={24} />
            </div>
          </div>
          <div className="my-5 h-2 overflow-hidden rounded-full bg-[#f0ece7]">
            <div className="h-full rounded-full bg-[#24243f]" style={{ width: `${readiness}%` }} />
          </div>
          <p className="text-sm leading-6 text-app-muted">
            就绪度按“已确认经历 / 全部未归档经历”计算。没有经历时为 0%，不会再显示假进度。
          </p>
          <Link href="/vault" className="btn primary mt-5 w-full">
            打开职业档案
            <ArrowUpRight size={17} />
          </Link>
        </aside>
      </section>

      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="app-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">下一步</h2>
            <CheckCircle2 size={20} className="text-app-green" />
          </div>
          <div className="space-y-3">
            {(nextActions.length ? nextActions : [{ title: '资料库状态良好', desc: '继续添加新经历或进入岗位分析。', href: '/vault' }]).map((item, i) => (
              <Link key={item.title} href={item.href} className="block rounded-[22px] bg-[#f8f4ef] p-4 transition hover:shadow-panel">
                <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-black">{i + 1}</div>
                <h3 className="text-sm font-black">{item.title}</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-app-muted">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="app-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">最近源材料</h2>
              <LibraryBig size={20} className="text-app-muted" />
            </div>
            <div className="space-y-3">
              {sources.slice(0, 4).map((source, i) => (
                <div key={source.id} className="flex gap-3 rounded-[20px] bg-[#f8f4ef] p-3">
                  <div className={`source-dot ${source.parse_status === 'parsed' ? 'confirmed' : ''}`}>S{i + 1}</div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black">{source.title}</h3>
                    <p className="text-xs font-semibold text-app-muted">{source.source_type === 'file' ? '文件' : '文本'} · {source.parse_status === 'uploaded' ? '已保存，待整理' : source.parse_status}</p>
                  </div>
                </div>
              ))}
              {!sources.length && (
                <EmptyBlock icon={<Plus size={18} />} title="还没有源材料" desc="先上传或粘贴一段经历内容。" href="/vault" />
              )}
            </div>
          </div>

          <div className="app-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">最近职业经历</h2>
              <FileText size={20} className="text-app-muted" />
            </div>
            <div className="space-y-3">
              {events.slice(0, 4).map((event) => (
                <Link key={event.id} href="/vault" className="block rounded-[20px] bg-[#f8f4ef] p-3 transition hover:shadow-panel">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black">{event.title}</h3>
                      <p className="mt-1 truncate text-xs font-semibold text-app-muted">{[event.organization, event.role].filter(Boolean).join(' · ') || '未填写组织/角色'}</p>
                    </div>
                    <span className={event.status === 'confirmed' ? 'badge-green' : event.status === 'needs_review' ? 'badge-red' : 'badge-amber'}>
                      {event.status === 'confirmed' ? '已确认' : event.status === 'needs_review' ? '需修改' : '待确认'}
                    </span>
                  </div>
                </Link>
              ))}
              {!events.length && (
                <EmptyBlock icon={<PencilLine size={18} />} title="还没有职业经历" desc="用固定字段手动新增一条经历。" href="/vault" />
              )}
            </div>
          </div>
        </div>
      </section>

      {!hasVaultData && (
        <section className="rounded-[28px] border border-dashed border-[#d8cec4] bg-white/64 p-6 text-center">
          <h2 className="text-xl font-black">当前账号还是空资料库</h2>
          <p className="mt-2 text-sm text-app-muted">先去职业档案页保存材料或手动新增经历，工作台就会变成真实数据视图。</p>
          <Link href="/vault" className="btn primary mt-5">
            开始整理
          </Link>
        </section>
      )}
    </div>
  )
}

function EmptyBlock({ icon, title, desc, href }: { icon: ReactNode; title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[20px] border border-dashed border-[#d8cec4] bg-white/58 p-4 text-left transition hover:shadow-panel">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f8f4ef] text-app-muted">{icon}</div>
      <div>
        <h3 className="text-sm font-black">{title}</h3>
        <p className="mt-1 text-xs font-semibold text-app-muted">{desc}</p>
      </div>
    </Link>
  )
}
