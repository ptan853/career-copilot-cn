'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TargetsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/jobs')
  }, [router])

  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-app-muted">正在跳转到岗位库...</p>
    </div>
  )
}
