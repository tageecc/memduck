# memduck 开源推广包

Repo: https://github.com/tageecc/memduck

## 定位

memduck 是一个自托管个人 AI 记忆工作台。它把链接、长文本、截图和聊天渠道输入消化成可追问、可引用、可回看的记忆卡片。

适合人群：

- 长期收集资料但很少真正复用的人
- 想把浏览器、Telegram、钉钉等输入统一到个人知识库的人
- 需要本地优先、自托管、可换模型 provider 的用户
- 喜欢研究个人知识管理和 AI agent memory 的开发者

不要夸大的点：

- 不要说它已经是团队协作平台
- 不要说所有渠道都是完整原生 runtime
- 不要说它替代 Notion、Obsidian 或所有 RAG 系统
- 不要承诺隐私绝对安全，只能说本地优先、自托管、密钥和运行时数据由用户自己管理

## 克制运营规则

- 每个平台首发只发一次，不复制粘贴同一段话刷屏。
- 回复只回答真实问题，不主动硬推。
- 不购买点赞、收藏、star、评论。
- 不伪装成第三方用户评价。
- 不隐藏项目早期状态，明确说是开源早期版本。
- 不自动发布；发布前人工确认账号、社区规则和最终内容。

## X / Twitter

短版：

```text
Open sourced memduck today.

It is a self-hosted personal AI memory workspace: save links, text, screenshots, Telegram/DingTalk-style channel input, then ask your saved memory with citations.

Built with Next.js, SQLite, shadcn/ui, AI SDK Elements.

https://github.com/tageecc/memduck
```

更个人一点：

```text
I kept saving links and screenshots, then never reused them.

So I built memduck: a self-hosted AI memory workspace that turns saved material into memory cards you can search, ask, and trace back to the source.

Early, open source, local-first.

https://github.com/tageecc/memduck
```

跟进回复：

```text
Current scope: single-user, self-hosted, SQLite, provider profiles, browser extension, Telegram native runtime, and webhook adapters for channels like Slack/Discord/Feishu/WhatsApp/DingTalk.
```

## V2EX

标题：

```text
开源了一个自托管个人 AI 记忆工作台：memduck
```

正文：

```text
最近把 memduck 整理到可以开源的程度了：

https://github.com/tageecc/memduck

它解决的问题比较具体：平时保存了很多链接、截图、长文本和聊天内容，但真正要复用时很难找，也很难追溯原文。

memduck 做的是：

- 把链接、文本、截图消化成结构化 memory card
- 支持 Ask，对自己的已保存内容提问
- 回答带 citations，可以回到原始 source chunk
- 模型 provider 可以在 UI 里配置和测试
- 渠道参考 OpenClaw 的 catalog 思路，支持浏览器扩展、Telegram，以及 Slack/Discord/Feishu/WhatsApp/DingTalk 这类 webhook adapter
- 本地优先，SQLite，单用户自托管

目前还是早期版本，不是团队协作平台，也不是 SaaS。更像一个给个人长期使用的 AI memory workspace。

如果你也有“资料保存很多，但复用很少”的问题，可以试试，欢迎提 issue。
```

## 掘金

标题：

```text
我开源了一个自托管 AI 记忆工作台：把链接、截图和聊天内容变成可追问的记忆
```

摘要：

```text
memduck 是一个 Next.js + SQLite 的个人 AI 记忆工作台，支持内容消化、语义搜索、Ask 问答、引用追溯和多渠道输入。
```

正文结构：

```markdown
我最近开源了 memduck：

https://github.com/tageecc/memduck

它不是一个通用笔记软件，而是想解决一个更窄的问题：我们保存了很多资料，但真正需要用的时候，经常找不到、想不起、也不知道原文在哪里。

memduck 的流程是：

1. 输入链接、长文本、截图或渠道消息
2. 系统消化成 memory card
3. 自动建立主题、chunk、embedding 和引用信息
4. 在 Ask 页面向自己的记忆提问
5. 回答可以追溯到原始来源

技术上目前是：

- Next.js App Router
- SQLite + better-sqlite3
- shadcn/ui + AI SDK Elements
- 本地 runtime 目录
- Manifest V3 浏览器扩展
- Telegram native runtime
- 多渠道 webhook adapter
- OpenAI / Anthropic / Gemini / Ollama / OpenAI-compatible 等 provider 配置

这个项目现在还是单用户、自托管、早期版本。我比较克制地没有做团队权限、多租户 SaaS、复杂工作流编排。

如果你对 personal knowledge management、AI memory、local-first 工具有兴趣，可以看看代码，也欢迎提 issue。
```

## Dev.to

Title:

```text
I open sourced a self-hosted AI memory workspace
```

Body:

```markdown
I open sourced memduck:

https://github.com/tageecc/memduck

The problem is simple: I save a lot of links, text, screenshots, and messages, but most of them never become reusable knowledge.

memduck turns those inputs into structured memory cards that can be searched, asked, and traced back to the original source.

What it does today:

- ingest links, text, screenshots, and channel messages
- digest them into memory cards
- store source chunks and citations
- ask questions against saved memory
- configure model providers in the UI
- support browser extension capture, Telegram runtime, and webhook adapters for channels like Slack, Discord, Feishu, WhatsApp, and DingTalk

Stack:

- Next.js
- SQLite / better-sqlite3
- shadcn/ui
- AI SDK Elements
- Manifest V3 extension

It is intentionally single-user and self-hosted for now. Not a SaaS, not a team knowledge base, not a generic workflow platform.

If you are interested in local-first personal AI memory tools, I would appreciate feedback.
```

## Reddit / Hacker News 风格

适合只发到一个相关社区，避免多社区重复投放。

标题：

```text
I built a self-hosted AI memory workspace for saved links, screenshots, and notes
```

正文：

```text
I open sourced memduck: https://github.com/tageecc/memduck

It is a small self-hosted app for turning saved material into reusable memory.

The core loop is:

- save a link, text, screenshot, or channel message
- digest it into a memory card
- store chunks and citations
- ask questions against your saved memory
- jump back to the original source

It is built with Next.js, SQLite, shadcn/ui, and AI SDK Elements. It has a browser extension, Telegram runtime, and webhook adapters for several chat channels.

It is early and intentionally single-user. I am sharing it because I want feedback from people who care about personal knowledge management, local-first tools, or AI memory systems.
```

## 小红书

标题：

```text
开源了一个给自己用的 AI 记忆工作台
```

正文：

```text
我最近把 memduck 开源了。

它是一个自托管的个人 AI 记忆工作台，用来处理一个很具体的问题：收藏了很多链接、截图、长文本，但真正要用时很难找回来。

现在它可以：

· 保存链接、文本、截图
· 消化成结构化记忆卡片
· 按主题整理
· 用 Ask 问自己的记忆库
· 回答时带引用，可以回到原始来源
· 配置不同模型 provider
· 接浏览器扩展、Telegram、钉钉这类渠道

它不是商业 SaaS，也不是团队知识库，目前更适合喜欢自托管和个人知识管理的人。

GitHub：github.com/tageecc/memduck
```

封面字：

```text
把收藏夹变成可追问的 AI 记忆库
```

## 微信公众号

标题：

```text
我开源了 memduck：一个自托管的个人 AI 记忆工作台
```

导语：

```text
它想解决的不是“保存更多”，而是让已经保存的内容真正变成可以复用、可以追问、可以追溯的记忆。
```

正文提纲：

```markdown
我最近把 memduck 开源了：

https://github.com/tageecc/memduck

做这个项目的原因很简单：我保存了太多资料，但真正复用时还是经常从零开始找。

浏览器收藏、截图、聊天里别人发的链接、临时复制的一大段文字，这些内容如果只是“存起来”，很快就会变成另一堆杂物。

memduck 想做的是把这些内容消化成个人记忆：

- 原始内容保留
- 摘要和要点结构化
- 来源可以追溯
- 可以按主题聚合
- 可以直接向自己的记忆库提问

现在的版本是一个单用户、自托管应用。技术栈比较直接：

- Next.js
- SQLite
- shadcn/ui
- AI SDK Elements
- 浏览器扩展
- Telegram runtime
- 多渠道 webhook adapter

我没有把它做成团队协作平台，也没有先做 SaaS。这个阶段更重要的是把个人使用闭环跑顺：输入内容、消化记忆、搜索、提问、回到来源。

如果你对个人知识管理、本地优先工具、AI memory 感兴趣，可以试试，也欢迎提 issue。
```

## 运营节奏

第一周：

- Day 1: GitHub public + X/V2EX 二选一首发
- Day 2: 回复真实问题，补 README FAQ
- Day 3: 发一篇技术向文章到掘金或 Dev.to
- Day 5: 总结收到的问题，开 issues 或 roadmap

后续：

- 每周最多 1 篇主帖
- 每周整理一次 issue / feedback
- 每个版本只发一次 release note
- 多平台内容要改写，不复制同一段
