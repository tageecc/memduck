# memduck MVP 设计方案

## 目标

这一版按“单用户、自部署、开箱即用的个人记忆引擎”来落地，重点放在：

- 低摩擦输入
- 比原文更值得再打开的记忆卡
- 会随着问答和回顾逐步体现偏好的轻量记忆系统

## 简化后的技术方向

参考 OpenClaw / Hermes 一类项目的轻架构做法，memduck 当前开发版本采用：

- 单仓库
- 单个 Next.js 应用
- SQLite 本地存储
- 本地 runtime 目录
- 一个轻量后台 compiler worker
- 一个 `memduck` CLI 负责 init / doctor / dev
- 薄入口适配器

开发阶段不引入 Docker，不拆 monorepo，但保留一个很轻的后台 worker 来持续编译 topic / review 结果。

## 入口结构

- Web：主界面与主 API
- Browser Extension：当前页 / 选中文本采集
- Telegram Bot：链接、文本、截图输入，问答与回顾

所有入口统一走同一套 contract：

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

## 数据对象

- `SourceItem`
- `MemoryCard`
- `Topic`
- `UserSignal`

当前实现中，这几类对象都直接落在 SQLite 中，避免额外基础设施。

## 本地运行方式

1. `pnpm install`
2. `pnpm memduck init`
3. `pnpm memduck doctor`
4. `pnpm memduck dev`

可选：

- `pnpm extension:build`
- `pnpm memduck dev --with-telegram`

## 下一阶段

- 更强的主题聚合
- 更完整的多渠道状态中心
- 更强的 topic compiler 与冲突观点建模
- 更细的回顾排序和主题回顾解释
