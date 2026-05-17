"use client";

import { CheckIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
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
import {
  errorMessageFromJson,
  readErrorMessage,
  readJsonObject,
} from "@/lib/http/response";
import type { Dictionary } from "@/lib/i18n";
import type { ProviderKind, SetupState } from "@/lib/memduck/service";
import {
  createProviderDraft,
  getProviderCatalogEntry,
  isProviderCatalogId,
  labelForProvider,
  listProviderCatalog,
  type ProviderCatalogId,
} from "@/lib/providers/provider-presets";

type PublicProviderProfile = {
  apiKey: string;
  apiKeyMasked: string;
  baseUrl: string;
  createdAt: string;
  hasApiKey: boolean;
  id: string;
  kind: ProviderKind;
  model: string;
  name: string;
  providerId?: string;
  updatedAt: string;
};

type CompletePublicProviderProfile = PublicProviderProfile & {
  providerId: ProviderCatalogId;
};

type StatusNotice = {
  message: string;
  tone: "error" | "success";
};

export function SetupWizard({
  copy,
  initialSetupState,
  variant = "dashboard",
}: {
  copy: Dictionary["setup"];
  initialSetupState: SetupState;
  variant?: "dashboard" | "onboarding";
}) {
  const router = useRouter();
  const initialDraft = createProviderDraft("openai");
  const isOnboarding = variant === "onboarding";
  const [setupState, setSetupState] = useState(initialSetupState);
  const [profiles, setProfiles] = useState<CompletePublicProviderProfile[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState(initialDraft.name);
  const [providerId, setProviderId] = useState<ProviderCatalogId>("openai");
  const [baseUrl, setBaseUrl] = useState(initialDraft.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [providerModel, setProviderModel] = useState(initialDraft.model);
  const [onboardingProviderStep, setOnboardingProviderStep] = useState<
    "credentials" | "provider"
  >("provider");
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    useState<CompletePublicProviderProfile | null>(null);
  const providerCatalog = listProviderCatalog();
  const selectedProvider = getProviderCatalogEntry(providerId);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProviderId) ??
    profiles[0] ??
    null;

  function applyProfile(profile: CompletePublicProviderProfile) {
    setEditingProfileId(profile.id);
    setProviderId(profile.providerId);
    setProviderName(profile.name);
    setBaseUrl(profile.baseUrl);
    setApiKey("");
    setApiKeyMasked(profile.apiKeyMasked);
    setProviderModel(profile.model);
  }

  function resetDraft(nextProviderId: ProviderCatalogId = "openai") {
    const defaults = createProviderDraft(nextProviderId);
    setEditingProfileId(null);
    setProviderId(nextProviderId);
    setProviderName(defaults.name);
    setBaseUrl(defaults.baseUrl);
    setApiKey("");
    setApiKeyMasked("");
    setProviderModel(defaults.model);
    setOnboardingProviderStep("provider");
  }

  function startNewDraft() {
    resetDraft("openai");
    setStatusNotice({
      message: copy.providerDraftStarted,
      tone: "success",
    });
  }

  function editProfile(profile: CompletePublicProviderProfile) {
    applyProfile(profile);
    setStatusNotice({
      message: copy.providerDraftLoaded,
      tone: "success",
    });
  }

  function validateProviderDraft(): string | null {
    if (!providerName.trim()) {
      return copy.providerNameRequired;
    }

    if (!providerModel.trim()) {
      return copy.providerModelRequired;
    }

    if (selectedProvider.configurableBaseUrl && !baseUrl.trim()) {
      return copy.providerBaseUrlRequired;
    }

    if (selectedProvider.requiresApiKey && !apiKey.trim()) {
      return copy.providerApiKeyRequired;
    }

    return null;
  }

  async function refreshSetupState() {
    const response = await fetch("/api/setup-state");
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "设置状态加载失败。"));
    }

    const payload = (await readJsonObject(
      response,
    )) as Partial<SetupState> | null;
    if (!payload || typeof payload.providerConfigured !== "boolean") {
      throw new Error("设置状态加载失败。");
    }

    setSetupState(payload as SetupState);
  }

  const refreshProviders = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/settings/providers");
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "模型配置加载失败。"));
      }

      const payload = (await readJsonObject(response)) as Partial<{
        activeProviderId: string | null;
        profiles: PublicProviderProfile[];
      }> | null;

      if (!payload || !Array.isArray(payload.profiles)) {
        throw new Error("模型配置加载失败。");
      }

      const profiles = payload.profiles.filter(
        (profile): profile is CompletePublicProviderProfile =>
          isProviderCatalogId(profile.providerId),
      );

      setProfiles(profiles);
      setActiveProviderId(
        profiles.some((profile) => profile.id === payload.activeProviderId)
          ? (payload.activeProviderId ?? null)
          : null,
      );

      if (profiles.length === 0) {
        resetDraft("openai");
        return true;
      }

      const active =
        profiles.find((profile) => profile.id === payload.activeProviderId) ??
        profiles[0];

      if (active) {
        applyProfile(active);
      }
      return true;
    } catch (error) {
      setStatusNotice({
        message: error instanceof Error ? error.message : "模型配置加载失败。",
        tone: "error",
      });
      return false;
    }
  });

  useEffect(() => {
    void refreshProviders();
  }, []);

  function updateProvider(nextProviderId: ProviderCatalogId) {
    const defaults = createProviderDraft(nextProviderId);
    setProviderId(nextProviderId);
    setBaseUrl(defaults.baseUrl);
    setProviderModel(defaults.model);
    setApiKey("");
    setApiKeyMasked("");
    if (!editingProfileId) {
      setProviderName(defaults.name);
    }
  }

  function buildSettingsPayload() {
    const payload: {
      apiKey?: string;
      baseUrl?: string;
      model: string;
      providerId: ProviderCatalogId;
    } = {
      apiKey,
      model: providerModel,
      providerId,
    };

    if (selectedProvider.configurableBaseUrl) {
      payload.baseUrl = baseUrl;
    }

    return payload;
  }

  async function runProviderTest() {
    const validationError = validateProviderDraft();
    if (validationError) {
      setStatusNotice({ message: validationError, tone: "error" });
      return;
    }

    setPending(true);
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/provider/test", {
        body: JSON.stringify(buildSettingsPayload()),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = await readJsonObject(response);

          if (!response.ok) {
            throw new Error(
              errorMessageFromJson(payload, "Provider 连接测试失败。"),
            );
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
          setPending(false);
        });
    });
  }

  async function saveProviderProfile() {
    const validationError = validateProviderDraft();
    if (validationError) {
      setStatusNotice({ message: validationError, tone: "error" });
      return;
    }

    setPending(true);
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/providers", {
        body: JSON.stringify({
          ...buildSettingsPayload(),
          id: editingProfileId ?? undefined,
          makeActive: true,
          name: providerName,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = await readJsonObject(response);

          if (!response.ok) {
            throw new Error(
              errorMessageFromJson(payload, "Provider 保存失败。"),
            );
          }

          if (!(await refreshProviders())) {
            return;
          }
          await refreshSetupState();
          setStatusNotice({ message: copy.providerSaved, tone: "success" });
          if (isOnboarding) {
            router.push("/");
          }
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  async function activateProfile(profileId: string) {
    setPending(true);
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/providers/activate", {
        body: JSON.stringify({ id: profileId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          const payload = await readJsonObject(response);

          if (!response.ok) {
            throw new Error(
              errorMessageFromJson(payload, "无法激活 Provider。"),
            );
          }

          if (!(await refreshProviders())) {
            return;
          }
          await refreshSetupState();
          setStatusNotice({
            message: copy.providerActivated,
            tone: "success",
          });
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  async function deleteProfile(profileId: string) {
    setPending(true);
    setStatusNotice(null);

    startTransition(() => {
      void fetch("/api/settings/providers", {
        body: JSON.stringify({ id: profileId }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      })
        .then(async (response) => {
          const payload = await readJsonObject(response);

          if (!response.ok) {
            throw new Error(
              errorMessageFromJson(payload, "无法删除 Provider。"),
            );
          }

          if (!(await refreshProviders())) {
            return;
          }
          await refreshSetupState();
          setDeleteCandidate(null);
          setStatusNotice({ message: copy.providerRemoved, tone: "success" });
        })
        .catch((error: Error) => {
          setStatusNotice({ message: error.message, tone: "error" });
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  const statusResult = statusNotice ? (
    <Alert variant={statusNotice.tone === "error" ? "destructive" : "default"}>
      <AlertDescription>{statusNotice.message}</AlertDescription>
    </Alert>
  ) : null;

  const providerPicker = (
    <Field>
      <FieldLabel>{copy.providerSelect}</FieldLabel>
      <Select value={providerId} onValueChange={updateProvider}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{copy.builtInProviders}</SelectLabel>
            {providerCatalog
              .filter((provider) => provider.id !== "custom")
              .map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.label}
                </SelectItem>
              ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>{copy.customProviders}</SelectLabel>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );

  const providerModelField = (
    <Field>
      <FieldLabel htmlFor="provider-model">{copy.model}</FieldLabel>
      <Input
        id="provider-model"
        list={`provider-models-${providerId}`}
        onChange={(event) => setProviderModel(event.target.value)}
        placeholder={selectedProvider.defaultModel}
        value={providerModel}
      />
      <datalist id={`provider-models-${providerId}`}>
        {selectedProvider.models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </datalist>
    </Field>
  );

  const credentialFields = (
    <>
      {selectedProvider.configurableBaseUrl ? (
        <Field>
          <FieldLabel htmlFor="provider-base-url">{copy.baseUrl}</FieldLabel>
          <Input
            id="provider-base-url"
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={selectedProvider.baseUrl}
            value={baseUrl}
          />
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor="provider-api-key">
          {selectedProvider.requiresApiKey ? copy.apiKey : copy.apiKeyOptional}
        </FieldLabel>
        <Input
          id="provider-api-key"
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            apiKeyMasked
              ? apiKeyMasked
              : selectedProvider.requiresApiKey
                ? copy.apiKey
                : copy.apiKeyOptional
          }
          type="password"
          value={apiKey}
        />
      </Field>
    </>
  );

  const providerFields = (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="provider-profile-name">
          {copy.profileName}
        </FieldLabel>
        <Input
          id="provider-profile-name"
          onChange={(event) => setProviderName(event.target.value)}
          placeholder={copy.profileName}
          value={providerName}
        />
      </Field>
      {providerModelField}
      {credentialFields}
    </FieldGroup>
  );

  const providerActions = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={pending}
          onClick={runProviderTest}
          size="xs"
          type="button"
        >
          {pending ? (
            <Loader2Icon className="animate-spin" data-icon="inline-start" />
          ) : null}
          {pending ? copy.testing : copy.testDraft}
        </Button>
        <Button
          disabled={pending}
          onClick={saveProviderProfile}
          size="xs"
          type="button"
          variant="secondary"
        >
          {editingProfileId ? copy.updateActivate : copy.saveActivate}
        </Button>
        {!isOnboarding ? (
          <Button
            disabled={pending}
            onClick={startNewDraft}
            size="xs"
            type="button"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            {copy.newDraft}
          </Button>
        ) : null}
      </div>
      {statusResult}
    </div>
  );

  if (isOnboarding) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-4 px-4 py-8">
        <div className="text-center font-semibold uppercase">memduck</div>
        {!setupState.providerConfigured ? (
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="border-b">
              <CardDescription>{copy.step1}</CardDescription>
              <CardTitle>{copy.providerTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {onboardingProviderStep === "provider" ? (
                <FieldSet>
                  <FieldGroup>
                    {providerPicker}
                    {providerModelField}
                  </FieldGroup>
                </FieldSet>
              ) : (
                <FieldSet>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{selectedProvider.label}</Badge>
                    <Badge variant="outline">{providerModel}</Badge>
                  </div>
                  <FieldGroup>{credentialFields}</FieldGroup>
                </FieldSet>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2 bg-transparent">
              {onboardingProviderStep === "provider" ? (
                <Button
                  disabled={!providerModel.trim()}
                  onClick={() => setOnboardingProviderStep("credentials")}
                  size="xs"
                  type="button"
                >
                  {copy.continue}
                </Button>
              ) : (
                <>
                  <Button
                    disabled={pending}
                    onClick={() => setOnboardingProviderStep("provider")}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    {copy.back}
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={runProviderTest}
                    size="xs"
                    type="button"
                    variant="secondary"
                  >
                    {pending ? copy.testing : copy.testDraft}
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={saveProviderProfile}
                    size="xs"
                    type="button"
                  >
                    {copy.saveActivate}
                  </Button>
                </>
              )}
            </CardFooter>
            {statusResult ? (
              <CardContent className="pt-0">{statusResult}</CardContent>
            ) : null}
          </Card>
        ) : (
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>{copy.openWorkspace}</CardTitle>
              {activeProfile ? (
                <CardAction>
                  <Badge variant="secondary">{activeProfile.name}</Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardFooter className="justify-end bg-transparent">
              <Button asChild size="xs">
                <Link href="/ask">{copy.openWorkspace}</Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>{copy.providerTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <FieldSet>
            <FieldGroup>
              {providerPicker}
              {providerFields}
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex-col items-start gap-3 bg-transparent sm:flex-row sm:items-center sm:justify-between">
          {providerActions}
        </CardFooter>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>{copy.providerLibrary}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-1">
          {profiles.length > 0 ? (
            profiles.map((profile) => (
              <Card className="bg-background/70" key={profile.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    {profile.name}
                    {profile.id === activeProviderId ? (
                      <Badge className="ml-2" variant="secondary">
                        {copy.active}
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>
                    {labelForProvider(profile.providerId)} · {profile.model}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="truncate text-muted-foreground text-sm">
                    {profile.baseUrl}
                  </p>
                </CardContent>
                <CardFooter className="gap-2 bg-transparent">
                  <Button
                    disabled={pending}
                    onClick={() => editProfile(profile)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    {copy.editDraft}
                  </Button>
                  {profile.id !== activeProviderId ? (
                    <Button
                      disabled={pending}
                      onClick={() => activateProfile(profile.id)}
                      size="xs"
                      type="button"
                      variant="secondary"
                    >
                      <CheckIcon data-icon="inline-start" />
                      {copy.activate}
                    </Button>
                  ) : null}
                  <Button
                    disabled={pending}
                    onClick={() => setDeleteCandidate(profile)}
                    size="xs"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon data-icon="inline-start" />
                    {copy.delete}
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">{copy.noProviders}</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleteCandidate(null);
          }
        }}
        open={deleteCandidate !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除模型配置</DialogTitle>
            <DialogDescription>
              将删除「{deleteCandidate?.name ?? "当前配置"}」及其保存的 API
              Key。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setDeleteCandidate(null)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={pending || !deleteCandidate}
              onClick={() => {
                if (deleteCandidate) {
                  void deleteProfile(deleteCandidate.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              {pending ? (
                <Loader2Icon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              {pending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
