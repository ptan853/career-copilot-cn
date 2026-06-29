'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser } from '@/lib/api-client'
import AppShell from '@/components/app-shell'

const PUBLIC_PREFIXES = ['/login', '/signup', '/auth/callback']

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  const isPublic = pathname === '/' || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  useEffect(() => {
    if (isPublic) {
      setChecking(false)
      return
    }

    getCurrentUser().then(user => {
      if (user) {
        setChecking(false)
      } else {
        const next = encodeURIComponent(pathname)
        router.replace(`/login?next=${next}`)
      }
    })
  }, [pathname, isPublic, router])

  if (isPublic) return <>{children}</>

  if (checking) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2f6cff] to-[#1ca6a8] grid place-items-center text-white font-extrabold text-lg mx-auto mb-3 animate-pulse">
            C
          </div>
          <p className="text-sm text-app-muted">正在加载...</p>
        </div>
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
