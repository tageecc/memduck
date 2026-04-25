# memduck MVP 架构设计

## 目标

memduck 当前版本按“单用户、自部署、开箱即用的个人记忆引擎”落地。核心目标不是保存更多内容，而是把外部输入变成可追溯、可问答、可回顾、会随着使用变深的私人记忆。

这一版重点保证三件事：

- 输入低摩擦：Web、浏览器插件、Telegram 都走同一条采集 contract。
- 处理结果真实：链接必须真实抓取正文，图片必须真实进入视觉分析，provider 配置缺失必须失败。
- 记忆可追溯：问答引用落到 source chunk，而不是停在摘要文本。

## 技术形态

当前实现参考 OpenClaw / Hermes Agent 一类轻架构项目，采用：

- 单仓库
- 单个 Next.js Web/API 应用
- SQLite 本地存储
- 本地 runtime 目录保存数据库与文件资产
- 一个轻量 compiler worker
- 一个 `memduck` CLI 负责 `init` / `doctor` / `dev`
- 薄入口适配器：Browser Extension 与 Telegram Bot

开发阶段不引入 Docker，不拆 monorepo，不引入多租户系统，也不把默认路径设计成 SaaS。

CLI 采用显式命令语义：无参数只输出 help，未知命令或未知 flag 会失败，Telegram 只在传入 `--with-telegram` 时启动。`init` 创建 `~/.memduck/memduck.env` 与 `~/.memduck/runtime`，让 npm 安装和源码开发共享同一套本地 runtime 语义。

## 入口结构

所有入口统一走同一套 `InputEnvelope`：

```ts
type InputEnvelope = {
  kind: "url" | "text" | "image";
  sourceChannel: "web" | "extension" | "telegram";
  requestedDepth: "save" | "quick" | "deep";
  payload: unknown;
  sourceContext?: {
    pageTitle?: string;
    caption?: string;
    tags?: string[];
  };
};
```

入口职责：

- Web：主界面、手动输入、管理、问答、回顾。
- Browser Extension：当前页与选中文本的低摩擦采集。
- Telegram Bot：链接、文本、截图输入，问答与回顾命令。

## 数据对象

当前核心对象：

- `SourceItem`：原始内容实体，保留链接、文本、图片资产、正文、快照路径。
- `SourceChunk`：从原始正文切出的可引用片段，带 embedding 与 offset。
- `MemoryCard`：结构化消化结果，包含 summary、deepSummary、keyPoints、evidence、worthSaving。
- `Topic`：长期主题对象。
- `TopicLink`：卡片与主题的模型解析关系，带 confidence 与 reason。
- `Conversation` / `ConversationMessage`：多轮问答历史。
- `ReviewCandidate`：回顾候选排序的中间对象。
- `UserSignal`：view、ask、follow_up、star、highlight、review_request 等行为信号。

`topic_ids_json` 保留为 memory card 的轻量读模型，主题关系的解释性来源是 `topic_links` 表。

## 处理流水线

一次输入会经历：

1. 入口提交 `InputEnvelope`
2. 根据类型准备 `SourceItem`
3. URL 真实抓取并抽取正文
4. Text 直接规范化
5. Image 走 provider 的视觉理解
6. provider 结构化编译 `MemoryCard`
7. 原文切分为 `SourceChunk` 并生成 embedding
8. provider 解析 `TopicLink`，必要时创建新 topic
9. 原子写入 source、card、embedding、chunks、topic links、save signal
10. worker 按需编译 topic summary 与 review buckets

任何 provider、fetch、vision、embedding、rerank、compiler JSON 失败都会显式失败，不写入伪成功卡片。模型 JSON 输出要求是完整 JSON 对象；如果 provider 在 JSON 外追加解释性文本，运行时会按协议错误处理。

## 检索与问答

Ask 流程：

1. 当前问题与最近多轮 user history 组成 retrieval question
2. 使用 provider embedding 生成 query vector
3. 从 card embedding 中做语义候选召回
4. 使用 provider rerank 对候选卡片重排
5. 从候选卡片的 `SourceChunk` 中选择可引用 source spans
6. provider 只基于已保存上下文回答
7. assistant message 与 citations 一起持久化

Citation 必须包含：

- `cardId`
- `sourceItemId`
- `chunkId`
- `quote`
- `startOffset`
- `endOffset`

## 主题与回顾

主题不是纯启发式聚类：

- ingest 时由 provider 解析已有 topic 命中或新 topic 创建。
- `TopicLink` 持久化 confidence 与 reason。
- topic 页面展示编译摘要、重复观点、冲突点、下一步问题和链接理由。

回顾不是即时拼凑：

- `listReviewCards()` 负责根据价值、时间间隔、信号、主题重复度做排序。
- `compileKnowledge()` 用 provider 编译 persisted review buckets。
- `/api/review` 与 Web Review 页面都读取相同的 compiled review contract。

## Provider 能力

Provider runtime 明确拆分能力：

- `summarize`
- `embed`
- `answer`
- `visionAnalyze`
- `rerank`
- `complete`

`complete` 支持 `answer` 与 `summarize` capability 路由。结构化记忆编译与 topic/review 编译走 `summarize`；主题解析走 `answer`。

当前支持：

- OpenAI
- Anthropic
- Gemini
- Ollama
- OpenAI-compatible

## 本地运行方式

```bash
pnpm install
pnpm memduck doctor
pnpm memduck dev
```

npm 安装路径：

```bash
npm install -g memduck@latest
memduck
```

可选：

```bash
pnpm extension:build
memduck --with-telegram
```

`doctor` 只读检查 `~/.memduck/memduck.env`、runtime 目录、SQLite 中的 provider/channel 配置，不初始化数据库，也不改变本地状态。

## 刻意不做

当前版本不做：

- 原生 App
- 团队协作
- 企业权限体系
- 多租户 SaaS
- 通用工作流编排平台
- 默认 Docker / Kubernetes 部署路径

这些不属于 memduck 第一阶段的差异化核心。
