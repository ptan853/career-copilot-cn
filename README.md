# Career Copilot CN

国内版 AI 求职 Copilot — 以职业事实库为核心的 AI 求职工作台。

## 技术栈

- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **后端**: Python FastAPI + SQLModel + PostgreSQL
- **AI**: DeepSeek / Qwen / Claude (支持 BYOK)
- **部署**: Docker Compose

## 快速开始

```bash
# 1. 安装依赖
cd apps/api && uv sync
cd apps/web && npm install

# 2. 启动数据库
docker compose up db redis -d

# 3. 启动后端
cd apps/api && uvicorn main:app --reload

# 4. 启动前端
cd apps/web && npm run dev

# 5. 打开 http://localhost:3000
```

## 目录结构

```
apps/
  web/     # Next.js 前端
  api/     # FastAPI 后端
docker-compose.yml
```

## 环境变量

复制 `apps/api/.env.example` 为 `apps/api/.env` 并填写：

```
DEEPSEEK_API_KEY=your_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/career_copilot
```

## License

MIT
