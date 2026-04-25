export const supportedLocales = ["en", "zh", "ja"] as const;
export const localePreferences = ["auto", ...supportedLocales] as const;

export type Locale = (typeof supportedLocales)[number];
export type LocalePreference = (typeof localePreferences)[number];

export const dictionaries = {
  en: {
    getStarted: {
      introBody:
        "Install the CLI, run one command, then finish provider setup in the browser.",
      introEyebrow: "Get Started",
      introTitle: "One command to boot your memory engine.",
      npmBody:
        "The public path is intentionally short: install the package and run memduck.",
      npmTitle: "Install from npm",
      openSetup: "Open setup",
      openWorkspace: "Open workspace",
      sourceBody:
        "Use the dev command only when you are working from a source checkout.",
      sourceTitle: "Develop from source",
      steps: {
        npmInstall: "Install the CLI",
        npmRun: "Launch memduck",
        provider: "Connect one provider",
        sourceInstall: "Install dependencies",
        sourceRun: "Run dev runtime",
      },
    },
    settings: {
      auto: "Auto",
      body: "Language defaults to your browser, but you can pin the console to one language.",
      english: "English",
      eyebrow: "Settings",
      japanese: "Japanese",
      language: "Language",
      save: "Save language",
      saved: "Language saved.",
      title: "Console preferences",
      zh: "Chinese",
    },
    setup: {
      active: "active",
      activate: "Activate",
      apiKey: "API key",
      apiKeyOptional: "API key (optional)",
      baseUrl: "Base URL",
      channelCenter: "Channel center",
      channelHint: "Extension and Telegram share the same ingest API.",
      channels: "Connect channels",
      channelsDetail:
        "Add browser or Telegram capture when the core loop works.",
      currentRuntime: "Current runtime",
      delete: "Delete",
      editDraft: "Edit",
      firstMemory: "First memory",
      firstMemoryDetail: "Create one card from a URL, text, or image.",
      firstMemoryTitle: "Create the first memory",
      introBody:
        "Connect a provider, create one card, then add capture channels.",
      introEyebrow: "Setup",
      introTitle: "Bring memduck online.",
      jumpFirstMemory: "Create memory",
      newDraft: "New",
      noActiveProvider: "No active provider",
      noProviders: "No providers yet.",
      openChannels: "Open channels",
      openQuickstart: "Quickstart",
      openWorkspace: "Open memduck",
      pending: "Pending",
      profileName: "Profile name",
      provider: "Provider",
      providerConnected: "Provider connected",
      providerDetail: "One real model provider powers digest, search, and Ask.",
      providerLibrary: "Providers",
      providerTitle: "Connect provider",
      ready: "Ready",
      recommended: "Next",
      recommendedChannels: "Core loop works. Add the entry surfaces you use.",
      recommendedMemory: "Now create one real memory card.",
      recommendedProvider: "Save and activate one provider first.",
      saveActivate: "Save",
      setupState: "State",
      step1: "Step 1",
      step2: "Step 2",
      step3: "Step 3",
      testDraft: "Test",
      testing: "Testing...",
      updateActivate: "Update",
    },
    shell: {
      brandCopy: "Digest links, text, and screenshots into searchable memory.",
      brandTitle: "Personal memory engine",
      command: "Run",
      nav: {
        ask: "Ask",
        channels: "Channels",
        home: "Home",
        inbox: "Inbox",
        review: "Review",
        search: "Search",
        settings: "Settings",
        setup: "Setup",
        topics: "Topics",
      },
    },
  },
  ja: {
    getStarted: {
      introBody:
        "CLI を入れて 1 つのコマンドを実行し、ブラウザでプロバイダーを設定します。",
      introEyebrow: "はじめる",
      introTitle: "1 コマンドでメモリーエンジンを起動。",
      npmBody:
        "公開版の導線は短くします。パッケージを入れて memduck を実行します。",
      npmTitle: "npm からインストール",
      openSetup: "セットアップを開く",
      openWorkspace: "ワークスペースを開く",
      sourceBody:
        "ソースチェックアウトから開発するときだけ dev コマンドを使います。",
      sourceTitle: "ソースから開発",
      steps: {
        npmInstall: "CLI をインストール",
        npmRun: "memduck を起動",
        provider: "プロバイダーを接続",
        sourceInstall: "依存関係をインストール",
        sourceRun: "開発ランタイムを起動",
      },
    },
    settings: {
      auto: "自動",
      body: "言語はブラウザに合わせます。必要なら固定できます。",
      english: "英語",
      eyebrow: "設定",
      japanese: "日本語",
      language: "言語",
      save: "言語を保存",
      saved: "言語を保存しました。",
      title: "コンソール設定",
      zh: "中国語",
    },
    setup: {
      active: "有効",
      activate: "有効化",
      apiKey: "API キー",
      apiKeyOptional: "API キー（任意）",
      baseUrl: "Base URL",
      channelCenter: "チャンネルセンター",
      channelHint: "拡張機能と Telegram は同じ取り込み API を使います。",
      channels: "チャンネルを接続",
      channelsDetail: "基本ループが動いたらブラウザや Telegram を追加します。",
      currentRuntime: "現在のランタイム",
      delete: "削除",
      editDraft: "編集",
      firstMemory: "最初のメモリー",
      firstMemoryDetail: "URL、テキスト、画像から 1 枚のカードを作ります。",
      firstMemoryTitle: "最初のメモリーを作成",
      introBody:
        "プロバイダーを接続し、1 枚のカードを作ってから取り込みチャンネルを追加します。",
      introEyebrow: "セットアップ",
      introTitle: "memduck を起動しましょう。",
      jumpFirstMemory: "メモリーを作る",
      newDraft: "新規",
      noActiveProvider: "有効なプロバイダーなし",
      noProviders: "プロバイダーはまだありません。",
      openChannels: "チャンネルを開く",
      openQuickstart: "クイックスタート",
      openWorkspace: "memduck を開く",
      pending: "未完了",
      profileName: "プロファイル名",
      provider: "プロバイダー",
      providerConnected: "プロバイダー接続",
      providerDetail: "実プロバイダーが要約、検索、Ask を支えます。",
      providerLibrary: "プロバイダー",
      providerTitle: "プロバイダーを接続",
      ready: "完了",
      recommended: "次にやること",
      recommendedChannels:
        "基本ループは動いています。よく使う入口を追加します。",
      recommendedMemory: "次に本物のメモリーカードを 1 枚作ります。",
      recommendedProvider: "まずプロバイダーを保存して有効化します。",
      saveActivate: "保存",
      setupState: "状態",
      step1: "ステップ 1",
      step2: "ステップ 2",
      step3: "ステップ 3",
      testDraft: "テスト",
      testing: "テスト中...",
      updateActivate: "更新",
    },
    shell: {
      brandCopy: "リンク、テキスト、スクリーンショットを検索できる記憶へ。",
      brandTitle: "個人メモリーエンジン",
      command: "起動",
      nav: {
        ask: "質問",
        channels: "チャンネル",
        home: "ホーム",
        inbox: "受信箱",
        review: "レビュー",
        search: "検索",
        settings: "設定",
        setup: "セットアップ",
        topics: "トピック",
      },
    },
  },
  zh: {
    getStarted: {
      introBody: "安装 CLI，运行一个命令，然后在浏览器里完成模型配置。",
      introEyebrow: "快速开始",
      introTitle: "一个命令启动你的记忆引擎。",
      npmBody: "公开安装路径保持极简：安装包，然后运行 memduck。",
      npmTitle: "通过 npm 安装",
      openSetup: "打开设置",
      openWorkspace: "进入工作台",
      sourceBody: "只有从源码开发时才需要使用 dev 命令。",
      sourceTitle: "从源码开发",
      steps: {
        npmInstall: "安装 CLI",
        npmRun: "启动 memduck",
        provider: "连接模型",
        sourceInstall: "安装依赖",
        sourceRun: "启动开发运行时",
      },
    },
    settings: {
      auto: "自动",
      body: "默认跟随浏览器语言，也可以固定控制台语言。",
      english: "英文",
      eyebrow: "设置",
      japanese: "日文",
      language: "语言",
      save: "保存语言",
      saved: "语言已保存。",
      title: "控制台偏好",
      zh: "中文",
    },
    setup: {
      active: "当前",
      activate: "启用",
      apiKey: "API Key",
      apiKeyOptional: "API Key（可选）",
      baseUrl: "Base URL",
      channelCenter: "渠道中心",
      channelHint: "浏览器插件和 Telegram 使用同一条采集 API。",
      channels: "连接渠道",
      channelsDetail: "核心闭环跑通后，再接入浏览器或 Telegram。",
      currentRuntime: "当前运行时",
      delete: "删除",
      editDraft: "编辑",
      firstMemory: "第一条记忆",
      firstMemoryDetail: "从 URL、文本或图片创建一张卡片。",
      firstMemoryTitle: "创建第一条记忆",
      introBody: "连接模型，创建一张卡，再接入日常采集渠道。",
      introEyebrow: "设置",
      introTitle: "启动 memduck。",
      jumpFirstMemory: "创建记忆",
      newDraft: "新建",
      noActiveProvider: "暂无启用模型",
      noProviders: "还没有模型配置。",
      openChannels: "打开渠道",
      openQuickstart: "快速开始",
      openWorkspace: "进入 memduck",
      pending: "未完成",
      profileName: "配置名称",
      provider: "模型",
      providerConnected: "模型已连接",
      providerDetail: "一个真实模型配置负责消化、搜索和问答。",
      providerLibrary: "模型配置",
      providerTitle: "连接模型",
      ready: "完成",
      recommended: "下一步",
      recommendedChannels: "核心闭环已跑通，接入你常用的入口。",
      recommendedMemory: "现在创建第一张真实记忆卡。",
      recommendedProvider: "先保存并启用一个模型配置。",
      saveActivate: "保存",
      setupState: "状态",
      step1: "步骤 1",
      step2: "步骤 2",
      step3: "步骤 3",
      testDraft: "测试",
      testing: "测试中...",
      updateActivate: "更新",
    },
    shell: {
      brandCopy: "把链接、文本和截图消化成可搜索的私人记忆。",
      brandTitle: "个人记忆引擎",
      command: "启动",
      nav: {
        ask: "提问",
        channels: "渠道",
        home: "首页",
        inbox: "收件箱",
        review: "回顾",
        search: "搜索",
        settings: "设置",
        setup: "配置",
        topics: "主题",
      },
    },
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function normalizeLocalePreference(
  value: string | null | undefined,
): LocalePreference {
  if (localePreferences.includes(value as LocalePreference)) {
    return value as LocalePreference;
  }

  return "auto";
}

export function resolveLocale(
  preference: LocalePreference,
  acceptLanguage: string | null,
): Locale {
  if (preference !== "auto") {
    return preference;
  }

  for (const entry of acceptLanguage?.split(",") ?? []) {
    const tag = entry.split(";")[0]?.trim().toLowerCase();
    if (!tag) {
      continue;
    }

    if (tag.startsWith("zh")) {
      return "zh";
    }
    if (tag.startsWith("ja")) {
      return "ja";
    }
    if (tag.startsWith("en")) {
      return "en";
    }
  }

  return "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
