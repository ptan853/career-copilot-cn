'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getCurrentUser, logout, type AuthUser } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import {
  Archive,
  BriefcaseBusiness,
  CalendarCheck,
  FilePenLine,
  Home,
  LibraryBig,
  LogOut,
  MessageSquareText,
  Plus,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: '首页', icon: Home },
  { href: '/vault', label: '职业档案', icon: LibraryBig },
  { href: '/jobs', label: '岗位', icon: BriefcaseBusiness },
  { href: '/generate', label: '生成', icon: Sparkles },
  { href: '/editor', label: '编辑', icon: FilePenLine },
  { href: '/prep', label: '面试', icon: MessageSquareText },
  { href: '/tracker', label: '进度', icon: CalendarCheck },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null))
  }, [])

  const displayName = user?.name || user?.email?.split('@')[0] || '用户'
  const avatarText = displayName.slice(0, 1).toUpperCase()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen p-3 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-56px)] max-w-[1480px] grid-cols-1 overflow-hidden rounded-[34px] border border-white/70 bg-[#fffdf9]/92 shadow-[0_28px_90px_rgba(76,101,115,.18)] backdrop-blur md:grid-cols-[92px_1fr]">
        <aside className="hidden bg-[#f4efe8]/92 px-4 py-5 md:flex md:flex-col md:items-center">
          <Link
            href="/dashboard"
            className="mb-8 grid h-12 w-12 place-items-center rounded-[18px] bg-app-ink text-xl font-black text-white shadow-nav-active"
            aria-label="求索 Copilot"
          >
            求
          </Link>

          <nav className="flex flex-1 flex-col items-center gap-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = path === item.href || path.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    'grid h-12 w-12 place-items-center rounded-full text-[#676a74] transition-all hover:bg-white hover:text-app-ink hover:shadow-panel',
                    active && 'bg-app-ink text-white shadow-nav-active hover:bg-app-ink hover:text-white',
                  )}
                  aria-label={item.label}
                >
                  <Icon size={21} strokeWidth={active ? 2.6 : 2.2} />
                </Link>
              )
            })}
          </nav>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#676a74] shadow-sm" aria-label="设置">
              <Settings size={20} />
            </button>
            <button
              className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#676a74] shadow-sm hover:text-app-red"
              onClick={handleLogout}
              aria-label="退出登录"
            >
              <LogOut size={19} />
            </button>
          </div>
        </aside>

        <div className="min-w-0 bg-[#fffaf5]/72">
          <header className="sticky top-0 z-20 flex min-h-[78px] flex-wrap items-center gap-3 border-b border-app-line/70 bg-[#fffaf5]/86 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="min-w-[220px] flex-1">
              <p className="text-xs font-extrabold text-app-muted">求索 Copilot</p>
              <p className="mt-0.5 text-sm font-black text-app-ink">把经历整理成智能体可理解的职业资料库</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/vault" className="btn hidden sm:inline-flex">
                <Archive size={17} />
                添加材料
              </Link>
              <Link href="/jobs" className="btn primary">
                <Plus size={17} />
                添加岗位
              </Link>

              <div className="relative">
                <button
                  className="flex h-12 items-center gap-2 rounded-full border border-app-line bg-white/84 px-2.5 pr-4 font-bold text-app-ink shadow-sm"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7efff] text-sm text-app-blue-ink">
                    {avatarText}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-sm sm:block">{displayName}</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full z-30 mt-3 w-52 rounded-[20px] border border-app-line bg-white p-2 shadow-panel">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-extrabold">{displayName}</p>
                      <p className="truncate text-xs text-app-muted">{user?.email || '已登录'}</p>
                    </div>
                    <button
                      className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2.5 text-left text-sm font-bold text-app-red hover:bg-[#fff0f1]"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
