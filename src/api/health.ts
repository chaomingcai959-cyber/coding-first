// 后端连通性探测：联通则进入 API 模式，否则保持本地演示模式（联调切换点，规格 05 §2）
import { API_BASE, USER_ID } from "./client";

export async function probeBackend(timeoutMs = 1500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/api/channels`, {
      headers: { "X-User-Id": USER_ID },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
