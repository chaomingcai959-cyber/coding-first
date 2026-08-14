import { useEffect, useRef, useState } from "react";
import { useWorkbench } from "../store/workbench";
import aiAvatar from "../assets/ai-avatar.png";

// 快捷指令三组随状态切换（R6）
const QUICK_CMDS: Record<string, string[]> = {
  NO_CHANNEL: ["查询频道名称", "查询频道类型", "查询状态", "查询租户"],
  IDLE: ["帮我生成今天的播单", "找一下张艺谋的悬疑片", "现在播单里有什么", "把第 3 个删了"],
  CANDIDATES_REVIEW: ["全选", "加入播单末尾", "插入播单开头", "重新筛选"],
};

export default function AIPanel() {
  const {
    selectedId, playlists, messagesByChannel, aiPhase, aiTyping, candidates, checked,
    sendMessage, newRule, continueByRule, toggleCandidate, checkAllCandidates, applyCandidates,
    readonly, wsConnected, apiMode, hasMore, loadEarlierMessages,
  } = useWorkbench();
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // M1：仅渲染当前频道的会话切片，切换频道即切换会话
  const messages = selectedId == null ? [] : messagesByChannel[String(selectedId)] || [];

  const hasChannel = selectedId !== null;
  const playlistLen = selectedId ? (playlists[String(selectedId)] || []).length : 0;
  // U4：仅已选频道且播单非空时可见（只读模式下隐藏写入口，4.7-AC5）
  const canContinue = hasChannel && playlistLen > 0 && !readonly;
  const phase = !hasChannel ? "NO_CHANNEL" : aiPhase === "CANDIDATES_REVIEW" ? "CANDIDATES_REVIEW" : "IDLE";
  // U5/B14：只读模式或 WS 断连时输入置灰
  const inputDisabled = !hasChannel || readonly || (apiMode === true && !wsConnected);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiTyping]);

  // F4/U1 微信式上翻分页：滚动到顶部加载更早记录，并保持阅读位置
  const onScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop > 8 || !hasMore) return;
    const h = el.scrollHeight;
    await loadEarlierMessages();
    el.scrollTop = el.scrollHeight - h;
  };

  const submit = (text: string) => {
    if (!text.trim()) return;
    if (text === "全选") { checkAllCandidates(); return; }
    if (text === "加入播单末尾") { applyCandidates("append"); return; }
    if (text === "插入播单开头") { applyCandidates("prepend"); return; }
    sendMessage(text);
    setInput("");
  };

  return (
    <div className="pl-right">
      <div className="ai-panel">
        <div className="ai-panel__hd">
          <div className="ai-panel__hd-glow"></div>
          <div className="ai-panel__hd-grid"></div>
          <div className="ai-panel__hd-inner">
            <img className="ai-panel__hd-avatar" src={aiAvatar} alt="AI" />
            <div className="ai-panel__hd-text">
              <div className="ai-panel__hd-title">✦ AI Director</div>
              <div className="ai-panel__hd-sub">随时调整你的播单</div>
            </div>
            <div className="ai-panel__hd-status">
              <span className="ai-panel__hd-pulse"></span>
              <span className="ai-panel__hd-status-text">ONLINE</span>
            </div>
          </div>
        </div>

        {/* U3/U4：顶部工具区（新增） */}
        <div className="ai-tools">
          <button className="ai-tools__btn" disabled={!hasChannel || readonly} onClick={newRule}>开启新规则</button>
          {canContinue && (
            <button className="ai-tools__btn" onClick={continueByRule}>按此规则继续生成</button>
          )}
        </div>

        <div className="ai-panel__bd" ref={bodyRef} onScroll={onScroll}>
          {!hasChannel && (
            <div className="ai-msg">
              <div className="ai-msg__head">AI DIRECTOR</div>
              <div className="ai-msg__text">你好，我是 AI Director。请先在左侧选择一个频道，我将引导你完成播单编排。</div>
            </div>
          )}

          {messages.map((m) => {
            if (m.kind === "divider")
              return <div key={m.id} className="ai-divider">以上对话已隔离，已开启全新对话规则</div>;
            if (m.kind === "event")
              return <div key={m.id} className="ai-event">— {m.text} · {m.time} —</div>;
            if (m.kind === "thinking")
              return (
                <div key={m.id} className="ai-thinking">
                  {m.steps.map((s, i) => (
                    <div key={i} className="ai-thinking__step">
                      <span className="ai-thinking__dot"></span>
                      <div>
                        <div className="ai-thinking__label">{s.label}</div>
                        <div className="ai-thinking__detail">{s.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            if (m.kind === "candidates")
              return (
                <div key={m.id} className="ai-picker-list">
                  {candidates.map((c) => (
                    <label key={c.id} className={`ai-pick-item ${checked.has(c.id) ? "ai-pick-item--on" : ""}`}>
                      <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleCandidate(c.id)} />
                      <div>
                        <div className="ai-pick-item__name">{c.name}</div>
                        <div className="ai-pick-item__meta">{c.cat} · {c.tag} · {c.provider}</div>
                      </div>
                    </label>
                  ))}
                  <div className="ai-cand-ops">
                    <button className="btn-o" onClick={checkAllCandidates}>
                      {checked.size === candidates.length ? "取消全选" : "全选"}
                    </button>
                    <span style={{ alignSelf: "center", fontSize: 12, color: "var(--primary-text-light)" }}>
                      已选 {checked.size} 条
                    </span>
                    <button className="btn-p" disabled={!checked.size} onClick={() => applyCandidates("prepend")}>插入开头</button>
                    <button className="btn-p" disabled={!checked.size} onClick={() => applyCandidates("append")}>追加末尾</button>
                    <button className="btn-p" disabled={!checked.size} onClick={() => applyCandidates("overwrite")}>清空覆盖</button>
                  </div>
                </div>
              );
            return (
              <div key={m.id} className={`ai-msg ${m.role === "user" ? "ai-msg--user" : "ai-msg--ai"}`}>
                <div className="ai-msg__head">
                  {m.role === "user" ? "你" : "AI DIRECTOR"} <span className="ai-msg__time">{m.time}</span>
                </div>
                <div className="ai-msg__text">{m.text}</div>
              </div>
            );
          })}

          {aiTyping && (
            <div className="ai-thinking">
              <div className="ai-thinking__step">
                <span className="ai-thinking__dot"></span>
                <div className="ai-thinking__label">AI 正在思考…</div>
              </div>
            </div>
          )}
        </div>

        <div className="ai-panel__ft">
          <div className="ai-qk">
            <div className="ai-qk__title">QUICK CMDS</div>
            <div className="ai-qk__list">
              {QUICK_CMDS[phase].map((cmd) => (
                <span key={cmd} className="ai-qk__item" onClick={() => submit(cmd)}>{cmd}</span>
              ))}
            </div>
          </div>
          <div className="ai-input">
            <input className="ai-input__field" value={input}
              placeholder={!hasChannel ? "请先选择频道" : readonly ? "只读模式，无法编辑" : apiMode === true && !wsConnected ? "连接已断开，等待重连…" : "告诉我你需要什么帮助..."}
              disabled={inputDisabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(input)} />
            <button className="ai-input__send" disabled={inputDisabled} onClick={() => submit(input)}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}
