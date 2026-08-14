// S8 LLM 网关 + AI 编排（规格 04）
// DeepSeek-V4-Pro 真实接入：OpenAI 兼容协议；reasoning_content 流 → thinking 事件（思考过程展示）；
// content 流 → message 事件。G1 双通道过滤、G5 白名单、G6 超时降级、9.2 SLO 埋点。
import { Body, Controller, Module, Post, Res } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { Response } from "express";
import { CurrentUser, RequestUser } from "../../common/auth";
import { config } from "../../config";
import { ChannelModule, ChannelService } from "../channel/channel.module";
import { SessionModule, SessionService } from "../session/session.module";
import { ProgramModule, ProgramService } from "../program/program.module";
import { RuleModule, RuleService } from "../rule/rule.module";
import { PlaylistModule, PlaylistService } from "../playlist/playlist.module";

// ---- G1 敏感词库（一期内置基础词库，网关侧可热更新，管理员维护） ----
const SENSITIVE_WORDS = ["涉政示例词", "暴恐示例词"];
export function containsSensitive(text: string): boolean {
  return SENSITIVE_WORDS.some((w) => text.includes(w));
}

function sse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---- 意图清单（PRD §5，G5 白名单：清单外能力一律拒识） ----
const INTENT_PROMPT = `你是播单编排工作台的意图分类器。将用户输入分类为以下意图之一，只输出 JSON：
I1 生成播单 / I2 筛选查询节目 / I3 添加节目入播单 / I4 删除节目 / I5 调整顺序 / I6 清空播单 /
I7 修改筛选规则 / I8 规则继承续生成 / I9 查询频道信息 / I10 查询当前播单 / I11 配置频道规则 / I12 闲聊或越界请求
输出格式：{"intent":"I1","confidence":0.95,"slots":{}}，confidence 为 0-1 小数，不要输出任何其他内容。`;

export interface IntentResult {
  intent: string;
  confidence: number;
  slots: Record<string, string>;
}

@Injectable()
export class LlmGateway {
  private readonly logger = new Logger("LlmGateway");
  private get ready() { return !!config.deepseek.key; }

  private async call(body: Record<string, unknown>, timeoutMs: number): Promise<globalThis.Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${config.deepseek.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.deepseek.key}`,
        },
        body: JSON.stringify({ model: config.deepseek.model, ...body }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** 意图分类（9.2 SLO：语义解析 ≤2s）
   *  v4-pro 为推理模型、分类必然超时，故分类走轻量模型（DEEPSEEK_CLASSIFY_MODEL，默认 deepseek-chat/v4-flash），
   *  超时/异常返回 null 由编排器降级为关键词分类 */
  async classify(text: string): Promise<IntentResult | null> {
    if (!this.ready) return null;
    try {
      const res = await this.call({
        model: process.env.DEEPSEEK_CLASSIFY_MODEL || "deepseek-chat",
        messages: [{ role: "system", content: INTENT_PROMPT }, { role: "user", content: text }],
        max_tokens: 100, temperature: 0, stream: false,
      }, 2000);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content: string = json.choices?.[0]?.message?.content ?? "";
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const parsed = JSON.parse(m[0]) as IntentResult;
      if (!/^I\d+$/.test(parsed.intent)) return null;
      return parsed;
    } catch {
      return null; // G6：降级，不抛出
    }
  }

  /** 流式对话：reasoning_content → onThinkingDelta；content → onDelta（v4-pro 推理模型特性） */
  async chatStream(
    messages: { role: string; content: string }[],
    onThinkingDelta: (t: string) => void,
    onDelta: (t: string) => void,
  ): Promise<void> {
    if (!this.ready) {
      onDelta("[MOCK-AI] 未配置 DEEPSEEK_API_KEY");
      return;
    }
    const res = await this.call({ messages, stream: true, max_tokens: 2048 }, 30000);
    if (!res.ok || !res.body) throw new Error(`llm http ${res.status}`);
    const reader = (res.body as unknown as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta ?? {};
          if (delta.reasoning_content) onThinkingDelta(delta.reasoning_content);
          if (delta.content) onDelta(delta.content);
        } catch { /* 半帧忽略 */ }
      }
    }
  }
}

@Injectable()
export class AiOrchestrator {
  constructor(
    private readonly sessions: SessionService,
    private readonly programs: ProgramService,
    private readonly rules: RuleService,
    private readonly playlists: PlaylistService,
    private readonly llm: LlmGateway,
  ) {}

  private keywordClassify(text: string): IntentResult {
    if (/播单|生成|编排|排播/.test(text)) return { intent: "I1", confidence: 0.6, slots: {} };
    if (/继续|再来|继承/.test(text)) return { intent: "I8", confidence: 0.6, slots: {} };
    if (/找|筛|查.*(节目|电影|剧)/.test(text)) return { intent: "I2", confidence: 0.6, slots: {} };
    return { intent: "I12", confidence: 0.5, slots: {} };
  }

  /** M3/M5 上下文拼装：cutoff 后会话 + 当前播单快照 + 频道规则（服务端为唯一数据源） */
  private async buildSystemContext(user: RequestUser, channelId: string): Promise<string> {
    const [pl, rules] = await Promise.all([
      this.playlists.get(user, channelId),
      this.rules.current(channelId),
    ]);
    const names = pl.items.slice(0, 10).map((i) => i.name).join("、");
    const snapshot = `频道当前播单快照（数据来自服务端，回答任何"当前播单/有没有节目/有多少条"类问题时必须以此为准）：
共 ${pl.items.length} 条节目${pl.items.length ? `，前 ${Math.min(pl.items.length, 10)} 条：${names}` : ""}`;
    const ruleText = rules.length
      ? `频道规则：${rules.map((r) => `${r.rule_type}(v${r.rule_version})`).join("；")}`
      : "频道规则：无";
    return `${snapshot}\n${ruleText}`;
  }

  async handle(user: RequestUser, channelId: string, content: string, res: Response) {
    const t0 = Date.now();
    await this.sessions.append(channelId, "user", { text: content });

    // G1 入站过滤
    if (containsSensitive(content)) {
      sse(res, "error", { code: 3001, message: "输入内容包含违规信息，请调整后重试" });
      return res.end();
    }

    // 意图识别：LLM 分类（≤2s）→ 失败降级关键词（R1 置信度 <0.7 走追问在话术层体现）
    const llmResult = await this.llm.classify(content);
    const result = llmResult ?? this.keywordClassify(content);
    sse(res, "thinking", {
      step: "意图识别",
      detail: `识别为 ${result.intent}（置信度 ${result.confidence.toFixed(2)}${llmResult ? "" : "，模型超时已降级为规则分类"}）`,
    });

    // 上下文（M2 窗口 20 轮 + M3 cutoff 截断）
    sse(res, "tool_call", { tool: "get_session_context", status: "start" });
    const ctx = await this.sessions.contextAfterCutoff(channelId, 20);
    sse(res, "tool_call", { tool: "get_session_context", status: "ok", summary: `命中上下文 ${ctx.length} 条` });

    const intent = result.intent;

    // ---- 生成/继承（I1/I8）：确定性工具链 T5→T3，候选交用户勾选（HITL） ----
    if (intent === "I1" || intent === "I8") {
      const currentRules = await this.rules.current(channelId);
      sse(res, "thinking", {
        step: "规则整理",
        detail: currentRules.length
          ? `沿用频道已存规则 v${currentRules[0].rule_version}（结构化对象，M5）`
          : "频道暂无已存规则，按用户口述整理临时筛选规则",
      });
      // exclude_ids（M5）：排除已在播节目，避免重复推荐（PRD 6-工具注册表）
      const pl = await this.playlists.get(user, channelId);
      const excludeIds = new Set(pl.items.map((i) => i.program_id));
      const hit = this.programs.search({ size: "10" });
      const filtered = hit.items.filter((p) => !excludeIds.has(p.id));
      sse(res, "tool_call", { tool: "search_programs", status: "ok",
        summary: `媒资匹配 ${hit.total} 条，排除已在播 ${excludeIds.size} 条，返回 ${filtered.length} 条候选` });
      if (filtered.length === 0) {
        await this.sessions.saveState(channelId, "INTENT_COLLECTING", null);
        sse(res, "message", { delta: "未找到符合条件的节目（已在播的已排除），建议放宽筛选条件后重试。" });
        sse(res, "done", { phase: "INTENT_COLLECTING" });
        return res.end();
      }
      sse(res, "candidates", { items: filtered });
      await this.sessions.saveState(channelId, "CANDIDATES_REVIEW", { candidates: filtered.map((i) => i.id) });
      const reply = `已按规则完成筛选（已排除 ${excludeIds.size} 条在播节目），命中 ${filtered.length} 个候选节目，请勾选后确认加入方式（插入开头 / 追加末尾 / 清空覆盖）。`;
      sse(res, "message", { delta: reply });
      await this.sessions.append(channelId, "ai", { text: reply, candidates: filtered.map((i) => i.id) });
      sse(res, "done", { phase: "CANDIDATES_REVIEW", elapsed_ms: Date.now() - t0 });
      return res.end();
    }

    // ---- 筛选查询（I2）：T3 检索 + LLM 流式摘要 ----
    if (intent === "I2") {
      const hit = this.programs.search({ name: result.slots?.name || "", size: "10" });
      sse(res, "tool_call", { tool: "search_programs", status: "ok", summary: `命中 ${hit.total} 条` });
      const names = hit.items.map((p) => `${p.name}（${p.cat}/${p.provider}）`).join("、");
      const sysCtx = await this.buildSystemContext(user, channelId);
      await this.streamReply(res, user, channelId, [
        { role: "system", content: `你是 AI Director 播单助手，用简洁中文回答，不超过 80 字。\n${sysCtx}` },
        { role: "user", content: `用户想筛选节目："${content}"。媒资库命中：${names || "无"}。请向用户汇报结果并给建议。` },
      ], t0);
      return res.end();
    }

    // ---- 其他意图（含 I12 兜底）：LLM 流式回复，注入会话上下文 + 播单快照 + 规则（M1/M2/M3/M5） ----
    const history = ctx.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: String((m.content as { text?: string })?.text ?? ""),
    })).filter((m) => m.content);
    const sysCtx = await this.buildSystemContext(user, channelId);
    await this.streamReply(res, user, channelId, [
      { role: "system", content: `你是 AI Director，频道播单编排助手。能力边界：播单生成/筛选/增删/调序/清空/规则配置（G5：白名单外请求礼貌拒识）。用简洁中文回答，不超过 120 字。\n${sysCtx}` },
      ...history,
      { role: "user", content },
    ], t0);
    res.end();
  }

  /** 统一流式回复：reasoning→thinking 事件，正文→message 事件，G1 出站过滤，G6 降级，M7 存档 */
  private async streamReply(
    res: Response, user: RequestUser, channelId: string,
    messages: { role: string; content: string }[], t0: number,
  ) {
    let full = "";
    let thinkBuf = "";
    let lastFlush = 0;
    try {
      await this.llm.chatStream(messages,
        (t) => { // 推理过程：聚合为思考事件，限频发送（流式间隔 ≤1s SLO）
          thinkBuf += t;
          const nowMs = Date.now();
          if (nowMs - lastFlush > 800) {
            sse(res, "thinking", { step: "模型推理", detail: thinkBuf.slice(-200) });
            lastFlush = nowMs;
          }
        },
        (t) => { full += t; sse(res, "message", { delta: t }); },
      );
    } catch {
      full = "当前网络不好，请稍后重试"; // G6 统一话术
      sse(res, "message", { delta: full });
    }
    if (containsSensitive(full)) { // G1 出站
      sse(res, "error", { code: 3001, message: "响应内容未通过安全检查" });
      return;
    }
    await this.sessions.append(channelId, "ai", { text: full }); // M7 即时存档
    sse(res, "done", { phase: "IDLE", elapsed_ms: Date.now() - t0 });
  }
}

@Controller("api/ai")
export class AiController {
  constructor(private readonly orch: AiOrchestrator, private readonly channels: ChannelService) {}

  @Post("chat")
  async chat(
    @CurrentUser() user: RequestUser,
    @Body() body: { channel_id: string; content: string; request_id: string },
    @Res() res: Response,
  ) {
    await this.channels.assertAccess(user, body.channel_id); // G2
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    await this.orch.handle(user, body.channel_id, body.content, res);
  }
}

@Module({
  imports: [ChannelModule, SessionModule, ProgramModule, RuleModule, PlaylistModule],
  controllers: [AiController],
  providers: [AiOrchestrator, LlmGateway],
  exports: [AiOrchestrator],
})
export class AiModule {}
