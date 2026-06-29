'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: '仪表盘' },
  { href: '/vault', label: '职业档案' },
  { href: '/targets', label: '岗位库' },
  { href: '/settings', label: '设置' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Top Nav */}
      <header className="h-14 bg-white border-b border-[#D0D5DD] flex items-center px-6 sticky top-0 z-50">
        <Link href="/dashboard" className="font-bold text-[#1B4A8F] text-lg mr-8">
          Career Copilot
        </Link>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                path.startsWith(item.href)
                  ? 'bg-[#EEF4FF] text-[#1B4A8F]'
                  : 'text-[#5A6A7A] hover:text-[#1A1A2E] hover:bg-gray-100'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-sm text-[#5A6A7A]">用户</div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
