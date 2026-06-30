'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProfile, updateProfile, getCurrentUser, logout } from '@/lib/api-client'
import type { AuthUser } from '@/lib/api-client'

const providerPresets: Record<string, { label: string; baseUrl: string; modelName: string; help: string }> = {
  bailian_qwen: {
    label: '阿里云百炼 / 通义千问（国内推荐）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-plus',
    help: '适合国内用户，第一版用于文字、文件解析后的 Markdown 和公开网页文本解析。',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    modelName: 'gpt-4.1-mini',
    help: '适合海外网络环境，后续会作为 hosted tools 能力的参考实现。',
  },
  kimi: {
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelName: 'kimi-k2',
    help: '适合中文长文本分析，第一版先作为普通模型调用。',
  },
  custom_openai_compatible: {
    label: '自定义 OpenAI 兼容接口',
    baseUrl: '',
    modelName: '',
    help: '用于 DeepSeek、OneAPI、LiteLLM、本地模型或公司内部网关。',
  },
}

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
          ai_provider: data.ai_provider || 'bailian_qwen',
          ai_provider_name: data.ai_provider_name || '',
          ai_api_base: data.ai_api_base || providerPresets[data.ai_provider || 'bailian_qwen']?.baseUrl || '',
          ai_model_name: data.ai_model_name || providerPresets[data.ai_provider || 'bailian_qwen']?.modelName || '',
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
        ai_provider: profile.ai_provider || 'bailian_qwen',
        ai_provider_name: profile.ai_provider_name || undefined,
        ai_api_base: profile.ai_api_base || undefined,
        ai_model_name: profile.ai_model_name || undefined,
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
              <p className="text-xs text-app-muted mt-1">选择用于职业档案解析的模型服务商。文件和链接会先在本地转成文本，再交给模型。</p>
            </div>
            <span className="badge-amber">可选</span>
          </div>
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-app-muted font-semibold">AI 服务商</span>
              <select
                className="input"
                value={profile.ai_provider || 'bailian_qwen'}
                onChange={e => {
                  const preset = providerPresets[e.target.value]
                  setProfile({
                    ...profile,
                    ai_provider: e.target.value,
                    ai_provider_name: preset?.label || '',
                    ai_api_base: preset?.baseUrl || '',
                    ai_model_name: preset?.modelName || '',
                  })
                }}
              >
                {Object.entries(providerPresets).map(([value, preset]) => (
                  <option key={value} value={value}>{preset.label}</option>
                ))}
              </select>
            </label>
            <div className="rounded-[14px] bg-app-panel-soft p-3 text-xs leading-relaxed text-app-muted">
              {providerPresets[profile.ai_provider || 'bailian_qwen']?.help}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-app-muted font-semibold">配置名称</span>
              <input
                className="input"
                value={profile.ai_provider_name || ''}
                onChange={e => setProfile({ ...profile, ai_provider_name: e.target.value })}
                placeholder="例如：我的百炼 Qwen"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-app-muted font-semibold">Base URL</span>
              <input
                className="input"
                value={profile.ai_api_base || ''}
                onChange={e => setProfile({ ...profile, ai_api_base: e.target.value })}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-app-muted font-semibold">模型名称</span>
              <input
                className="input"
                value={profile.ai_model_name || ''}
                onChange={e => setProfile({ ...profile, ai_model_name: e.target.value })}
                placeholder="qwen-plus"
              />
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
              服务器不会回传已保存的完整 Key。第一版先支持 OpenAI-compatible 调用，不启用 hosted web search / file search。
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
