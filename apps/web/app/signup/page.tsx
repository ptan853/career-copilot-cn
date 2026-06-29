'use client'

import { Suspense } from 'react'
import { AuthEntryPage } from '@/components/auth/auth-screen'

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#f7f9fc]">
          <p className="text-sm font-semibold text-[#667085]">加载中...</p>
        </div>
      }
    >
      <AuthEntryPage initialMode="signup" />
    </Suspense>
  )
}
