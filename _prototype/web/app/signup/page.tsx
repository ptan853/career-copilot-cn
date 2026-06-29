'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const signup = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/email-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: name }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '注册失败')
      }
      const data = await res.json()
      localStorage.setItem('token', data.access_token)
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-[#D0D5DD] p-8">
        <h1 className="text-xl font-bold text-[#1A1A2E] mb-1">注册</h1>
        <p className="text-sm text-[#5A6A7A] mb-6">创建你的 Career Copilot 账号</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#5A6A7A] mb-1 block">昵称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如何称呼你"
              className="w-full h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
            />
          </div>
          <div>
            <label className="text-sm text-[#5A6A7A] mb-1 block">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="w-full h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
            />
          </div>
          <div>
            <label className="text-sm text-[#5A6A7A] mb-1 block">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置密码"
              className="w-full h-10 px-3 border border-[#D0D5DD] rounded-lg text-sm focus:outline-none focus:border-[#1B4A8F]"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <button
          onClick={signup}
          disabled={loading}
          className="w-full h-10 mt-5 bg-[#1B4A8F] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50"
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <p className="text-sm text-center text-[#5A6A7A] mt-4">
          已有账号？
          <Link href="/login" className="text-[#1B4A8F] font-medium ml-1">登录</Link>
        </p>
      </div>
    </div>
  )
}
