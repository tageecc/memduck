import { describe, expect, it } from "vitest";

import { normalizeLocalePreference, resolveLocale } from "../src/lib/i18n";

describe("i18n", () => {
  it("resolves auto language from Accept-Language", () => {
    expect(resolveLocale("auto", "zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(resolveLocale("auto", "ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(resolveLocale("auto", "fr-FR,fr;q=0.9")).toBe("en");
  });

  it("lets explicit language override browser language", () => {
    expect(resolveLocale("en", "zh-CN,zh;q=0.9")).toBe("en");
    expect(resolveLocale("zh", "ja-JP,ja;q=0.9")).toBe("zh");
    expect(resolveLocale("ja", "en-US,en;q=0.9")).toBe("ja");
  });

  it("normalizes unknown preferences to auto", () => {
    expect(normalizeLocalePreference("fr")).toBe("auto");
    expect(normalizeLocalePreference(null)).toBe("auto");
  });
});
