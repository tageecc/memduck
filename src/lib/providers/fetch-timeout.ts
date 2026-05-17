export const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

export async function withProviderTimeout<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("Provider request timed out."));
        }, PROVIDER_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function fetchWithProviderTimeout(
  fetcher: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      fetcher(input, {
        ...init,
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Provider request timed out."));
        }, PROVIDER_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Provider request timed out.");
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function readProviderJson(response: Response): Promise<unknown> {
  return withProviderTimeout(() => response.json());
}

export async function readProviderText(response: Response): Promise<string> {
  return withProviderTimeout(() => response.text());
}
