'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { storeToken } from '@/lib/api-client'

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get('token')
    const next = params.get('next') || '/dashboard'
    if (token) {
      storeToken(token)
      router.replace(next)
    } else {
      router.replace('/login?error=google_auth_failed')
    }
  }, [params, router])

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <p className="text-sm text-app-muted">正在登录...</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-app-bg flex items-center justify-center"><p className="text-sm text-app-muted">加载中...</p></div>}>
      <CallbackInner />
    </Suspense>
  )
}
