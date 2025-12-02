import { API_URL } from "../config/api";

export interface ApiRequestOptions extends RequestInit {
  authToken?: string | null;
  skipJson?: boolean;
}

const buildHeaders = (options?: ApiRequestOptions) => {
  const headers = new Headers(options?.headers || {});
  if (options?.authToken) {
    headers.set("Authorization", `Bearer ${options.authToken}`);
  }
  if (!options?.skipJson && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
};

export async function apiFetch(path: string, options?: ApiRequestOptions) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(options),
  });
  if (!response.ok) {
    let detail: any;
    try {
      detail = await response.json();
    } catch {
      detail = { detail: response.statusText };
    }
    throw new Error(detail?.detail || "Erro ao comunicar com o servidor");
  }
  return response;
}

export async function apiGet<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const response = await apiFetch(path, { ...options, method: "GET" });
  return response.json();
}

export async function apiPost<T>(
  path: string,
  body: any,
  options?: ApiRequestOptions,
): Promise<T> {
  const init: ApiRequestOptions = { ...options, method: "POST" };
  if (body instanceof FormData) {
    init.body = body;
    init.skipJson = true;
  } else {
    init.body = JSON.stringify(body);
  }
  const response = await apiFetch(path, init);
  return response.json();
}

