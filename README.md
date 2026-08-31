# Speakwow

实时语音陪练 + 结构化课程的英语学习产品。AI 陪练 = 每个学生的家庭老师（Frank / Lucy 双人格），课堂 + 自学作业体系一等公民。

## 结构

```
apps/
  web/      Next.js 15.5（Vercel）——学生端/老师端页面 + LiveKit 实时对话 UI
  agent/    LiveKit Agents Python（Railway）——家庭老师语音 Agent
packages/
  shared/   跨端共享：人格卡数据（personas/）+ TS 类型（types/）
supabase/
  migrations/  Postgres schema（Auth/DB/RLS）
  config.toml
.github/workflows/
  web.yml      PR 门禁：pnpm lint + build
  agent.yml    PR 门禁：ruff + pytest（live 测试默认跳过）
  supabase.yml PR 门禁：migration 干跑
```

## 技术栈

Next.js 15 + Supabase（Auth/DB/Storage）+ LiveKit Agents（xAI Grok realtime 语音）+ Azure Speech（仅结构化练习发音评测）。

## 本地开发

```bash
# web
cd apps/web && cp .env.example .env.local && pnpm install && pnpm dev

# agent
cd apps/agent && cp .env.example .env.local && uv sync && uv run src/agent.py dev

# supabase（本地栈）
supabase start && supabase db reset
```

## 文档

- 总体规划 / 数据模型（C1-B）/ monorepo 与环境密钥治理（C1-C）：Speakwow 工作区
- 环境分层：dev（本地）/ staging（每 Cycle 精确 SHA 验收）/ prod（人工批准发布）
