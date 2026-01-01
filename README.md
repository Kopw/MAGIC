# MAGIC

全栈 AI 聊天应用 —— 支持多模型对话、工具调用（联网搜索 / 图片生成）、语音交互、对话分享。

## 技术栈

| 层 | 技术 |
|---|------|
| **框架** | Next.js 16 (App Router) + React 19 |
| **语言** | TypeScript |
| **数据库** | PostgreSQL 16 + Prisma ORM |
| **认证** | NextAuth（Google / GitHub / 邮箱密码） |
| **状态管理** | Zustand |
| **UI** | Tailwind CSS + shadcn/ui (Radix) + Lucide Icons |
| **AI** | 硅基流动 API（Chat / TTS / STT / 图片生成） |
| **搜索** | Tavily API（联网搜索） |
| **Markdown** | react-markdown + remark-gfm + rehype-highlight |
| **图表** | Recharts |
| **开发工具** | Docker Compose / Husky + Commitlint / Prettier / ESLint / Bundle Analyzer |

## 功能

### 💬 对话

- 流式响应（SSE），实时显示生成内容
- **思考模式**（推理过程可视化）：推理模型自动启用；部分对话模型可手动开关
- 会话管理：创建 / 删除 / 重命名 / 置顶
- 消息操作：复制 / 朗读 / 重试 / 编辑

### 🛠 工具调用（Function Calling）

- **联网搜索**：通过 Tavily API 实时检索并展示来源卡片
- **图片生成**：通过 SiliconFlow API (Kwai-Kolors) 生成图片，支持自定义尺寸与负面提示词，自动下载存储到本地

### 📊 富文本渲染

- Markdown 渲染（GFM 表格 / 代码高亮 / 行内公式）
- **媒体块**组件注册表：`weather` / `chart` / `image` 自动识别并渲染为交互式组件
- 代码块一键复制

### 🎙 语音

- **语音输入**：录音转文字（SenseVoice）
- **语音输出**：文字转语音（CosyVoice2，8 种预置音色 — Diana / Claire / Anna / Bella / Alex / David / Charles / Benjamin）
- 语音偏好持久化到 localStorage

### 📎 文件上传

- 支持 `.txt` / `.md` 文件（≤ 1 MB）
- 后端提取内容并注入对话上下文

### 🔗 分享

- 生成唯一 Token 链接，公开分享对话
- 分享页服务端渲染（RSC），含消息展示、页头、页脚与引导蒙版
- 浏览量统计

### 🔐 认证

- Google / GitHub OAuth 一键登录
- 邮箱 + 密码凭证登录
- JWT Session（7 天有效）
- OAuth 账号自动关联已有用户
- 审计日志（AuditLog）

### 🎨 其他

- 深色 / 浅色模式切换（next-themes）
- 导出对话为 Markdown
- 响应式侧边栏布局
- 会话搜索
- Landing Page（Hero + 教程引导）
- 全局错误边界（ErrorBoundary）
- 生产环境自动移除 `console.log`

## 开发

### 环境要求

- Node.js ≥ 22
- PostgreSQL 16
- pnpm

### 安装

```bash
pnpm install
```

### 配置

创建 `.env`：

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/magic"

# Auth
AUTH_SECRET="your-secret-key"
AUTH_TRUST_HOST="true"

# OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# 硅基流动 API（对话 / TTS / STT / 图片生成）
SILICONFLOW_API_KEY=""

# 联网搜索（可选）
TAVILY_API_KEY=""
```

### 数据库

```bash
# Docker 启动 PostgreSQL
pnpm docker:up

# 生成 Prisma Client
pnpm db:generate

# 运行迁移
pnpm db:migrate

# 填充测试数据（可选）
pnpm db:seed

# Prisma Studio
pnpm db:studio
```

### 运行

```bash
# 开发
pnpm dev

# 生产构建
pnpm build && pnpm start
```

### 其他脚本

```bash
pnpm clean:logs           # 清除 console.log（预览）
pnpm clean:logs --write   # 清除 console.log（执行）
pnpm docker:down          # 停止 Docker
pnpm docker:logs          # 查看 DB 日志
pnpm lint                 # ESLint
pnpm format               # Prettier 格式化
```

## 项目结构

```
app/                        # Next.js App Router
├── api/                   # API 路由
│   ├── auth/             # NextAuth 端点
│   ├── chat/             # 聊天（SSE 流式）
│   ├── conversations/    # 会话 CRUD
│   ├── export/           # 导出 Markdown
│   ├── image/            # 图片代理
│   ├── message/          # 消息操作
│   ├── share/            # 分享
│   ├── speech/           # 语音识别
│   ├── tts/              # 文字转语音
│   ├── upload/           # 文件上传
│   └── user/             # 用户信息
├── auth/                  # 认证页面（登录/错误）
├── chat/                  # 聊天页面
└── share/[token]/         # 分享页面（RSC）

components/                 # 全局组件
├── ui/                    # shadcn/ui 基础组件
├── icons/                 # 自定义图标
├── Header/                # 顶栏
├── Sidebar/               # 侧边栏
├── LandingPage/           # 首页（Hero + 教程）
├── ExportButton/          # 导出按钮
├── MainLayout/            # 主布局
└── ThemeToggle/           # 主题切换

features/                   # 功能模块
├── auth/                  # 认证（登录弹窗）
├── chat/                  # 聊天核心
│   ├── components/       # ChatInput / MessageContent / ModelSelector / ThinkingPanel 等
│   ├── constants/        # 模型配置 (models.ts)
│   ├── store/            # Chat Zustand Store
│   └── utils/            # Markdown 预处理
├── conversation/          # 会话管理（列表 / 搜索 / 排序）
├── share/                 # 分享（按钮 / 页面内容 / 蒙版）
└── voice/                 # 语音（录音 / 播放 / 音色配置）

server/                     # 服务端
├── auth/                  # NextAuth 配置 + JWT + 密码工具
├── db/                    # Prisma Client + Seed
├── middleware/            # 请求中间件
├── repositories/          # 数据访问层（User / Conversation / Message / AuditLog）
└── services/              # 业务逻辑
    ├── ai/               # SiliconFlow Chat API 封装
    ├── chat/             # 聊天服务（Prompt Builder / SSE Stream Handler）
    ├── export/           # Markdown 导出
    ├── image/            # 图片生成 + 存储
    └── tools/            # 工具系统（注册表 / 联网搜索 / 图片生成）

prisma/
└── schema.prisma          # 数据模型（User / Account / Conversation / Message / AuditLog）
```

## License

MIT
