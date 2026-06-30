'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, updateProfile, getCurrentUser, logout } from '@/lib/api-client'
import type { AuthUser } from '@/lib/api-client'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      getCurrentUser(),
      getProfile().catch(() => ({ data: null })),
    ]).then(([u, p]) => {
      setUser(u)
      const data = (p as any).data
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          headline: data.headline || '',
          location: data.location || '',
          summary: data.summary || '',
          years_of_experience: data.years_of_experience ?? '',
          target_roles_text: (data.target_roles || []).join('，'),
          target_locations_text: (data.target_locations || []).join('，'),
          ai_provider: 'openai',
          ai_api_key: '',
          has_ai_api_key: Boolean(data.has_ai_api_key),
        })
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await updateProfile({
        full_name: profile.full_name || undefined,
        headline: profile.headline || undefined,
        location: profile.location || undefined,
        summary: profile.summary || undefined,
        years_of_experience: profile.years_of_experience ? Number(profile.years_of_experience) : undefined,
        target_roles: profile.target_roles_text
          ? profile.target_roles_text.split(/[，,]/).map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        target_locations: profile.target_locations_text
          ? profile.target_locations_text.split(/[，,]/).map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        ai_provider: 'openai',
        ai_api_key: profile.ai_api_key || undefined,
      })
      setMessage('已保存')
      setTimeout(() => setMessage(''), 3000)
    } catch {} finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-app-muted">正在加载...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[28px] font-bold tracking-normal leading-tight">设置</h1>
        <p className="text-[13px] text-app-muted mt-1.5">管理你的账号信息和求职偏好。</p>
      </div>

      <div className="grid gap-5 max-w-[720px]">
        {/* Account info */}
        <div className="app-card p-5">
          <h2 className="text-xl font-black mb-4">账号信息</h2>
          {user && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-[14px] bg-app-panel-soft">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-app-ink text-lg font-black text-white shadow-nav-active">
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-black">{user.name || '未设置名称'}</p>
                  <p className="text-xs text-app-muted">{user.email || user.phone || '未绑定联系方式'}</p>
                </div>
              </div>
              <p className="text-xs text-app-muted">当前支持邮箱密码和 Google 登录。密码修改和更多安全设置即将上线。</p>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="app-card p-5">
          <h2 className="text-xl font-black mb-4">个人档案</h2>
          <div className="space-y-3">
            <input
              className="input"
              value={profile.full_name || ''}
              onChange={e => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="全名"
            />
            <input
              className="input"
              value={profile.headline || ''}
              onChange={e => setProfile({ ...profile, headline: e.target.value })}
              placeholder="一句话定位，例如：AI Agent 工程师"
            />
            <input
              className="input"
              value={profile.location || ''}
              onChange={e => setProfile({ ...profile, location: e.target.value })}
              placeholder="当前所在地，例如：深圳"
            />
            <input
              className="input"
              value={profile.years_of_experience ?? ''}
              onChange={e => setProfile({ ...profile, years_of_experience: e.target.value })}
              placeholder="工作年限"
              type="number"
            />
            <input
              className="input"
              value={profile.target_roles_text || ''}
              onChange={e => setProfile({ ...profile, target_roles_text: e.target.value })}
              placeholder="目标岗位，用逗号分隔，例如：Agent 工程师，AI 产品经理"
            />
            <input
              className="input"
              value={profile.target_locations_text || ''}
              onChange={e => setProfile({ ...profile, target_locations_text: e.target.value })}
              placeholder="意向城市，用逗号分隔，例如：深圳，北京，远程"
            />
            <textarea
              className="input min-h-[80px] resize-y"
              value={profile.summary || ''}
              onChange={e => setProfile({ ...profile, summary: e.target.value })}
              placeholder="个人简介，将在简历中使用"
            />
            <div className="flex items-center gap-3">
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存档案'}
              </button>
              {message && <span className="text-sm font-semibold text-app-green">{message}</span>}
            </div>
          </div>
        </div>

        {/* AI Provider */}
        <div className="app-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black">AI 配置</h2>
              <p className="text-xs text-app-muted mt-1">第一版统一使用 OpenAI，先跑通材料解析闭环。</p>
            </div>
            <span className="badge-amber">可选</span>
          </div>
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-app-muted font-semibold">AI 服务商</span>
              <select
                className="input"
                value="openai"
                disabled
              >
                <option value="openai">OpenAI</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-app-muted font-semibold">API Key</span>
                <span className="text-[10px] text-app-muted">
                  {profile.has_ai_api_key ? '已保存 Key，留空则不修改' : '留空则使用平台默认 Key'}
                </span>
              </div>
              <input
                className="input"
                value={profile.ai_api_key || ''}
                onChange={e => setProfile({ ...profile, ai_api_key: e.target.value })}
                placeholder={profile.has_ai_api_key ? '已配置，输入新 Key 可覆盖' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'}
                type="password"
              />
            </label>
            <div className="rounded-[14px] bg-[#fff8e7] p-3 text-xs text-[#86581f]">
              服务器不会回传已保存的完整 Key。当前版本先支持 OpenAI；DeepSeek/Qwen 会在核心解析链路稳定后再作为适配器加入。
            </div>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存 AI 配置'}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="app-card p-5 border-red-200">
          <h2 className="text-xl font-black text-app-red mb-4">账号操作</h2>
          <button className="btn w-full justify-center" style={{ borderColor: '#f0caca', color: '#bd3b3b' }} onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
