// API 客户端（规格 05 §3 / 02 §1）：统一 envelope 解析、X-User-Id 注入（C2）、错误码 → 用户可读提示
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:3000";
const USER_ID = (import.meta.env.VITE_USER_ID as string | undefined) ?? "u-yang"; // 一期调试身份

export class ApiError extends Error {
  constructor(public code: number, message: string, public traceId?: string) {
    super(message);
  }
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": USER_ID,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { code: number; data?: T; message?: string; trace_id?: string };
  if (json.code !== 0) throw new ApiError(json.code, json.message ?? "系统繁忙，请稍后重试", json.trace_id);
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

export { API_BASE, USER_ID };
