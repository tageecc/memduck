"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n";
import {
  type CompleteProviderCatalogEntry,
  createProviderDraft,
  getProviderCatalogEntry,
  isProviderCatalogId,
  labelForProvider,
  listProviderCatalog,
  type ProviderCapabilities,
  type ProviderCatalogId,
  providerCatalogIds,
} from "@/lib/providers/provider-presets";
import { cn } from "@/lib/utils";

type PublicProviderProfile = {
  apiKey: string;
  apiKeyMasked: string;
  baseUrl: string;
  createdAt: string;
  hasApiKey: boolean;
  id: string;
  kind: string;
  model: string;
  name: string;
  providerId?: string;
  updatedAt: string;
};

type CompletePublicProviderProfile = PublicProviderProfile & {
  providerId: ProviderCatalogId;
};

type ProviderCenterPayload = {
  activeProviderId: string | null;
  profiles: PublicProviderProfile[];
};

type ProviderFormState = {
  apiKey: string;
  apiKeyMasked: string;
  baseUrl: string;
  model: string;
  name: string;
  providerId: ProviderCatalogId;
};

type StatusNotice = {
  message: string;
  tone: "error" | "success";
};

type OpenCardId = string | "draft" | null;

const providerLogoSources = providerCatalogIds.reduce<
  Record<ProviderCatalogId, string>
>(
  (sources, providerId) => {
    sources[providerId] = `/provider-logos/${providerId}.svg`;
    return sources;
  },
  {} as Record<ProviderCatalogId, string>,
);

const capabilityLabels: Array<{
  key: keyof ProviderCapabilities;
  label: string;
}> = [
  { key: "chat", label: "Chat" },
  { key: "embedding", label: "Embedding" },
  { key: "rerank", label: "Rerank" },
  { key: "vision", label: "Vision" },
];

function ProviderLogo({
  providerId,
  framed = false,
  size = "default",
}: {
  providerId: ProviderCatalogId;
  framed?: boolean;
  size?: "default" | "sm";
}) {
  const src = providerLogoSources[providerId];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        framed
          ? size === "sm"
            ? "size-8 rounded-lg border bg-card p-1"
            : "size-10 rounded-xl border bg-card p-2 shadow-sm"
          : size === "sm"
            ? "size-5"
            : "size-6",
      )}
    >
      <span
        className={cn("relative block", size === "sm" ? "size-4" : "size-full")}
      >
        <Image
          alt=""
          className="object-contain"
          draggable={false}
          fill
          sizes={size === "sm" ? "16px" : "24px"}
          src={src}
          unoptimized
        />
      </span>
    </span>
  );
}

function toCompleteProfiles(
  profiles: PublicProviderProfile[],
): CompletePublicProviderProfile[] {
  return profiles.filter((profile): profile is CompletePublicProviderProfile =>
    isProviderCatalogId(profile.providerId),
  );
}

function formFromDraft(providerId: ProviderCatalogId): ProviderFormState {
  const defaults = createProviderDraft(providerId);

  return {
    apiKey: "",
    apiKeyMasked: "",
    baseUrl: defaults.baseUrl,
    model: defaults.model,
    name: defaults.name,
    providerId: defaults.providerId,
  };
}

function formFromProfile(
  profile: CompletePublicProviderProfile,
): ProviderFormState {
  return {
    apiKey: "",
    apiKeyMasked: profile.apiKeyMasked,
    baseUrl: profile.baseUrl,
    model: profile.model,
    name: profile.name,
    providerId: profile.providerId,
  };
}

export function ProviderCenter({ copy }: { copy: Dictionary["setup"] }) {
  const router = useRouter();
  const providerCatalog = listProviderCatalog();
  const builtInProviders = providerCatalog.filter(
    (provider) => provider.id !== "custom",
  );
  const [profiles, setProfiles] = useState<CompletePublicProviderProfile[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<OpenCardId>(null);
  const [formState, setFormState] = useState<ProviderFormState | null>(null);
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "activate" | "delete" | "save" | "test" | null
  >(null);

  const selectedProvider = formState
    ? getProviderCatalogEntry(formState.providerId)
    : null;

  const loadProviders = useEffectEvent(async () => {
    const response = await fetch("/api/settings/providers");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as ProviderCenterPayload;
    const nextProfiles = toCompleteProfiles(payload.profiles);

    setProfiles(nextProfiles);
    setActiveProviderId(
      nextProfiles.some((profile) => profile.id === payload.activeProviderId)
        ? payload.activeProviderId
        : null,
    );
  });

  useEffect(() => {
    void loadProviders();
  }, []);

  function applyPayload(payload: ProviderCenterPayload) {
    const nextProfiles = toCompleteProfiles(payload.profiles);
    setProfiles(nextProfiles);
    setActiveProviderId(
      nextProfiles.some((profile) => profile.id === payload.activeProviderId)
        ? payload.activeProviderId
        : null,
    );

    return nextProfiles;
  }

  function beginDraft(providerId: ProviderCatalogId) {
    setOpenCardId("draft");
    setFormState(formFromDraft(providerId));
    setStatusNotice(null);
  }

  function openProfile(profile: CompletePublicProviderProfile) {
    if (openCardId === profile.id) {
      setOpenCardId(null);
      setFormState(null);
      return;
    }

    setOpenCardId(profile.id);
    setFormState(formFromProfile(profile));
    setStatusNotice(null);
  }

  function updateForm(patch: Partial<ProviderFormState>) {
    setFormState((current) => (current ? { ...current, ...patch } : current));
  }

  function updateProvider(nextProviderId: ProviderCatalogId) {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      const defaults = createProviderDraft(nextProviderId);
      return {
        ...current,
        apiKey: "",
        apiKeyMasked: "",
        baseUrl: defaults.baseUrl,
        model: defaults.model,
        name: openCardId === "draft" ? defaults.name : current.name,
        providerId: nextProviderId,
      };
    });
  }

  function validateForm(
    form: ProviderFormState,
    provider: CompleteProviderCatalogEntry,
  ) {
    if (!form.name.trim()) {
      return copy.providerNameRequired;
    }

    if (!form.model.trim()) {
      return copy.providerModelRequired;
    }

    if (provider.configurableBaseUrl && !form.baseUrl.trim()) {
      return copy.providerBaseUrlRequired;
    }

    if (provider.requiresApiKey && !form.apiKey.trim()) {
      return copy.providerApiKeyRequired;
    }

    return null;
  }

  function buildSettingsPayload(form: ProviderFormState) {
    return {
      apiKey: form.apiKey,
      baseUrl: form.baseUrl,
      model: form.model,
      providerId: form.providerId,
    };
  }

  async function runProviderTest() {
    if (!formState || !selectedProvider) {
      return;
    }

    const validationError = validateForm(formState, selectedProvider);
    if (validationError) {
      setStatusNotice({ message: validationError, tone: "error" });
      return;
    }

    setPendingAction("test");
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/provider/test", {
        body: JSON.stringify(buildSettingsPayload(formState)),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Provider 连接测试失败。");
          }

          setStatusNotice({
            message: copy.providerTestPassed,
            tone: "success",
          });
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  async function saveProviderProfile() {
    if (!formState || !selectedProvider) {
      return;
    }

    const validationError = validateForm(formState, selectedProvider);
    if (validationError) {
      setStatusNotice({ message: validationError, tone: "error" });
      return;
    }

    setPendingAction("save");
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/providers", {
        body: JSON.stringify({
          ...buildSettingsPayload(formState),
          id: openCardId !== "draft" ? openCardId : undefined,
          makeActive: true,
          name: formState.name,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as
            | (ProviderCenterPayload & {
                error?: string;
                profile?: PublicProviderProfile;
              })
            | { error?: string };

          if (!response.ok) {
            throw new Error(payload.error ?? "Provider 保存失败。");
          }

          if (!("profiles" in payload)) {
            throw new Error("Provider 保存失败。");
          }

          applyPayload(payload);

          if (
            "profile" in payload &&
            payload.profile &&
            isProviderCatalogId(payload.profile.providerId)
          ) {
            const profile = payload.profile as CompletePublicProviderProfile;
            setOpenCardId(profile.id);
            setFormState(formFromProfile(profile));
          } else {
            setOpenCardId(null);
            setFormState(null);
          }

          setStatusNotice({ message: copy.providerSaved, tone: "success" });
          router.refresh();
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  async function activateProfile(profileId: string) {
    setPendingAction("activate");
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/providers/activate", {
        body: JSON.stringify({ id: profileId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            activeProviderId?: string | null;
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "无法激活 Provider。");
          }

          setActiveProviderId(payload.activeProviderId ?? null);
          setStatusNotice({
            message: copy.providerActivated,
            tone: "success",
          });
          router.refresh();
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  async function deleteProfile(profileId: string) {
    setPendingAction("delete");
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/providers", {
        body: JSON.stringify({ id: profileId }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      })
        .then(async (response) => {
          const payload = (await response.json()) as
            | ProviderCenterPayload
            | { error?: string };

          if (!response.ok) {
            throw new Error(
              "error" in payload
                ? (payload.error ?? "无法删除 Provider。")
                : "无法删除 Provider。",
            );
          }

          if (!("profiles" in payload)) {
            throw new Error("无法删除 Provider。");
          }

          applyPayload(payload);
          if (openCardId === profileId) {
            setOpenCardId(null);
            setFormState(null);
          }
          setStatusNotice({ message: copy.providerRemoved, tone: "success" });
          router.refresh();
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  const addedProfiles = profiles;
  const isDraftOpen = openCardId === "draft" && formState !== null;

  function renderProviderMenuItem(
    providerId: ProviderCatalogId,
    label: string,
  ) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        <ProviderLogo providerId={providerId} size="sm" />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  function renderProviderSelect() {
    if (!formState) {
      return null;
    }

    return (
      <Field>
        <FieldLabel>{copy.providerSelect}</FieldLabel>
        <Select onValueChange={updateProvider} value={formState.providerId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectGroup>
              <SelectLabel>{copy.builtInProviders}</SelectLabel>
              {builtInProviders.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {renderProviderMenuItem(provider.id, provider.label)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>{copy.customProviders}</SelectLabel>
              <SelectItem value="custom">
                {renderProviderMenuItem("custom", "Custom")}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    );
  }

  function renderCapabilityBadges(provider: CompleteProviderCatalogEntry) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {capabilityLabels.map((capability) => {
          const enabled = provider.capabilities[capability.key];

          return (
            <Badge
              className="h-5 rounded px-1.5 font-medium text-[0.68rem]"
              key={capability.key}
              variant={enabled ? "secondary" : "outline"}
            >
              {enabled ? capability.label : `${capability.label} 未启用`}
            </Badge>
          );
        })}
      </div>
    );
  }

  function renderFormFields() {
    if (!formState || !selectedProvider) {
      return null;
    }

    return (
      <FieldGroup className="gap-4">
        {renderProviderSelect()}

        <Field>
          <FieldLabel htmlFor={`provider-name-${openCardId ?? "none"}`}>
            {copy.profileName}
          </FieldLabel>
          <Input
            id={`provider-name-${openCardId ?? "none"}`}
            onChange={(event) => updateForm({ name: event.target.value })}
            value={formState.name}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`provider-model-${openCardId ?? "none"}`}>
            {copy.model}
          </FieldLabel>
          <Input
            id={`provider-model-${openCardId ?? "none"}`}
            list={`provider-models-${formState.providerId}`}
            onChange={(event) => updateForm({ model: event.target.value })}
            placeholder={selectedProvider.defaultModel}
            value={formState.model}
          />
          <datalist id={`provider-models-${formState.providerId}`}>
            {selectedProvider.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </datalist>
        </Field>

        <Field>
          <FieldLabel>能力</FieldLabel>
          {renderCapabilityBadges(selectedProvider)}
        </Field>

        {selectedProvider.configurableBaseUrl ? (
          <Field>
            <FieldLabel htmlFor={`provider-base-url-${openCardId ?? "none"}`}>
              {copy.baseUrl}
            </FieldLabel>
            <Input
              id={`provider-base-url-${openCardId ?? "none"}`}
              onChange={(event) => updateForm({ baseUrl: event.target.value })}
              placeholder={selectedProvider.baseUrl}
              value={formState.baseUrl}
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor={`provider-api-key-${openCardId ?? "none"}`}>
            {selectedProvider.requiresApiKey
              ? copy.apiKey
              : copy.apiKeyOptional}
          </FieldLabel>
          <Input
            id={`provider-api-key-${openCardId ?? "none"}`}
            onChange={(event) => updateForm({ apiKey: event.target.value })}
            placeholder={formState.apiKeyMasked || copy.apiKey}
            type="password"
            value={formState.apiKey}
          />
        </Field>
      </FieldGroup>
    );
  }

  function renderExpandedCard(profileId?: string) {
    const isEditingSavedProfile =
      Boolean(profileId) && openCardId === profileId;
    const isPending = pendingAction !== null;

    return (
      <CollapsibleContent>
        <CardContent className="pb-5">{renderFormFields()}</CardContent>
        <CardFooter className="justify-between gap-2 bg-transparent pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={isPending}
              onClick={runProviderTest}
              size="xs"
              type="button"
              variant="secondary"
            >
              {pendingAction === "test" ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {pendingAction === "test" ? copy.testing : copy.testDraft}
            </Button>
            <Button
              disabled={isPending}
              onClick={saveProviderProfile}
              size="xs"
              type="button"
            >
              {pendingAction === "save" ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              {isEditingSavedProfile ? copy.updateActivate : copy.saveActivate}
            </Button>
            {profileId && profileId !== activeProviderId ? (
              <Button
                disabled={isPending}
                onClick={() => activateProfile(profileId)}
                size="xs"
                type="button"
                variant="outline"
              >
                {pendingAction === "activate" ? (
                  <Loader2Icon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                {copy.activate}
              </Button>
            ) : null}
          </div>

          {profileId ? (
            <Button
              disabled={isPending}
              onClick={() => deleteProfile(profileId)}
              size="xs"
              type="button"
              variant="destructive"
            >
              {pendingAction === "delete" ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              {copy.delete}
            </Button>
          ) : (
            <Button
              disabled={isPending}
              onClick={() => {
                setOpenCardId(null);
                setFormState(null);
                setStatusNotice(null);
              }}
              size="xs"
              type="button"
              variant="outline"
            >
              取消
            </Button>
          )}
        </CardFooter>
      </CollapsibleContent>
    );
  }

  return (
    <section className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4 border-border/40 border-b pb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground leading-none">
            {copy.providerTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            连接模型服务，管理多份配置
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 shrink-0 rounded px-3 text-xs"
              size="sm"
              variant="outline"
            >
              <PlusIcon data-icon="inline-start" />
              添加模型
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[26rem] w-80 overflow-y-auto rounded-xl border bg-popover p-2 shadow-lg"
          >
            <DropdownMenuLabel className="px-3 py-2 tracking-[0.18em] uppercase">
              选择提供商
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {builtInProviders.map((provider) => (
                <DropdownMenuItem
                  className="h-8 gap-3 rounded-lg px-2.5 text-[0.8rem] font-medium"
                  key={provider.id}
                  onSelect={() => beginDraft(provider.id)}
                >
                  <ProviderLogo providerId={provider.id} size="sm" />
                  {provider.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="h-8 gap-3 rounded-lg px-2.5 text-[0.8rem] font-medium"
                onSelect={() => beginDraft("custom")}
              >
                <ProviderLogo providerId="custom" size="sm" />
                Custom
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isDraftOpen && formState ? (
        <Collapsible open>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <div className="flex min-w-0 items-center gap-3">
                <ProviderLogo providerId={formState.providerId} framed />
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <CardTitle>{formState.name}</CardTitle>
                  <Badge variant="outline">未保存</Badge>
                </div>
              </div>
              <CardAction className="flex items-center gap-1">
                <Button
                  onClick={() => {
                    setOpenCardId(null);
                    setFormState(null);
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronUpIcon />
                </Button>
              </CardAction>
            </CardHeader>
            {renderExpandedCard()}
          </Card>
        </Collapsible>
      ) : null}

      {addedProfiles.length === 0 ? (
        <Empty className="min-h-80 border-0 bg-card shadow-sm">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlusIcon />
            </EmptyMedia>
            <EmptyTitle>{copy.noProviders}</EmptyTitle>
            <EmptyDescription>点击右上角添加一个模型提供商。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {addedProfiles.map((profile) => {
            const open = openCardId === profile.id;
            const visibleName =
              open && formState ? formState.name : profile.name;
            const visibleProviderId =
              open && formState ? formState.providerId : profile.providerId;
            const visibleModel =
              open && formState ? formState.model : profile.model;

            return (
              <Collapsible key={profile.id} open={open}>
                <Card className="rounded-xl shadow-sm">
                  <CardHeader>
                    <div className="flex min-w-0 items-center gap-3">
                      <ProviderLogo providerId={visibleProviderId} framed />
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <CardTitle>{visibleName}</CardTitle>
                          {profile.id === activeProviderId ? (
                            <Badge variant="secondary">{copy.active}</Badge>
                          ) : null}
                        </div>
                        <CardDescription>
                          {labelForProvider(visibleProviderId)} · {visibleModel}
                        </CardDescription>
                      </div>
                    </div>
                    <CardAction className="flex items-center gap-1">
                      <Button
                        onClick={() => openProfile(profile)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </Button>
                    </CardAction>
                  </CardHeader>

                  {open ? renderExpandedCard(profile.id) : null}
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {statusNotice ? (
        <Alert
          variant={statusNotice.tone === "error" ? "destructive" : "default"}
        >
          <AlertDescription>{statusNotice.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
