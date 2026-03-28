import { env } from "../config/env";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  params?: Record<string, string | number>;
  body?: unknown;
  headers?: Record<string, string>;
  withAuth?: boolean;
};

const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function buildUrl(url: string, params?: Record<string, string | number>) {
  const fullUrl = `${env.apiBaseUrl}${url}`;

  if (!params) return fullUrl;

  const query = new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  return `${fullUrl}?${query}`;
}

async function request<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    params,
    body,
    headers,
    withAuth = true,
  } = options;

  const finalUrl = buildUrl(url, params);

  const response = await fetch(finalUrl, {
    method,
    headers: {
      ...defaultHeaders,
      ...(withAuth ? getAuthHeader() : {}),
      ...headers,
    },
    ...(body && method !== "GET"
      ? { body: JSON.stringify(body) }
      : {}),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const http = {
  public: {
    get: <T>(url: string, params?: RequestOptions["params"]) =>
      request<T>(url, { method: "GET", params, withAuth: false }),

    post: <T>(
      url: string,
      body?: unknown,
      headers?: RequestOptions["headers"]
    ) => request<T>(url, { method: "POST", body, headers, withAuth: false }),
  },

  private: {
    get: <T>(url: string, params?: RequestOptions["params"]) =>
      request<T>(url, { method: "GET", params, withAuth: true }),

    post: <T>(
      url: string,
      body?: unknown,
      headers?: RequestOptions["headers"]
    ) => request<T>(url, { method: "POST", body, headers, withAuth: true }),

    put: <T>(
      url: string,
      body?: unknown,
      headers?: RequestOptions["headers"]
    ) => request<T>(url, { method: "PUT", body, headers, withAuth: true }),

    patch: <T>(
      url: string,
      body?: unknown,
      headers?: RequestOptions["headers"]
    ) => request<T>(url, { method: "PATCH", body, headers, withAuth: true }),

    delete: <T>(url: string, params?: RequestOptions["params"]) =>
      request<T>(url, { method: "DELETE", params, withAuth: true }),
  },
};