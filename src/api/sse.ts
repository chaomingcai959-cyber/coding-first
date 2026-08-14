// SSE 消费器（规格 04 §4 / 05 §3）：POST /api/ai/chat 事件流 → 回调映射
import { API_BASE, USER_ID, newRequestId } from "./client";

export interface SseHandlers {
  onThinking?: (step: string, detail: string) => void;
  onToolCall?: (tool: string, status: string, summary?: string) => void;
  onCandidates?: (items: unknown[]) => void;
  onMessage?: (delta: string) => void;
  onDone?: (phase: string, version?: number) => void;
  onError?: (code: number, message: string) => void;
}

/** 消费 AI 对话 SSE 流；断连/失败由 onError 上报（B14 话术由调用方统一处理） */
export async function chatStream(channelId: string, content: string, handlers: SseHandlers): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": USER_ID },
    body: JSON.stringify({ channel_id: channelId, content, request_id: newRequestId() }),
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(9000, "当前网络不好，请稍后重试");
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const event = frame.match(/^event: (.+)$/m)?.[1]?.trim();
      const dataRaw = frame.match(/^data: (.+)$/m)?.[1];
      if (!event || !dataRaw) continue;
      const data = JSON.parse(dataRaw);
      switch (event) {
        case "thinking": handlers.onThinking?.(data.step, data.detail); break;
        case "tool_call": handlers.onToolCall?.(data.tool, data.status, data.summary); break;
        case "candidates": handlers.onCandidates?.(data.items); break;
        case "message": handlers.onMessage?.(data.delta); break;
        case "done": handlers.onDone?.(data.phase, data.version); break;
        case "error": handlers.onError?.(data.code, data.message); break;
      }
    }
  }
}
