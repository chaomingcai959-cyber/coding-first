import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../store/workbench";
import { PROGRAM_POOL, FILTER_OPTIONS, type Program } from "../mock/data";
import { programApi } from "../api/resources";
import { mapProgram } from "../api/mappers";

export default function AddProgramModal() {
  const { addModalOpen, setAddModal, addPrograms, apiMode } = useWorkbench();
  const [q, setQ] = useState({ cat: "", tag: "", provider: "", name: "", album: "" });
  const [applied, setApplied] = useState(q);
  const [checked, setChecked] = useState<Set<number | string>>(new Set());
  const [remoteList, setRemoteList] = useState<Program[]>([]);

  // API 模式：从媒资服务检索（S2）；演示模式：本地池过滤
  useEffect(() => {
    if (apiMode !== true || !addModalOpen) return;
    programApi.search({ cat: applied.cat, tag: applied.tag, provider: applied.provider, name: applied.name, album: applied.album, size: "100" })
      .then((r) => setRemoteList((r.items as Parameters<typeof mapProgram>[0][]).map(mapProgram)))
      .catch(() => setRemoteList([]));
  }, [apiMode, addModalOpen, applied]);

  const list = useMemo(
    () =>
      apiMode === true
        ? remoteList
        : PROGRAM_POOL.filter(
            (p) =>
              (!applied.cat || p.cat === applied.cat) &&
              (!applied.tag || p.tag === applied.tag) &&
              (!applied.provider || p.provider === applied.provider) &&
              (!applied.name || p.name.includes(applied.name)) &&
              (!applied.album || p.album.includes(applied.album))
          ),
    [apiMode, remoteList, applied]
  );
  const enabled = list.filter((p) => p.status === "启用");

  if (!addModalOpen) return null;

  const toggle = (id: number | string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  return (
    <div className="modal-mask show" onClick={(e) => e.target === e.currentTarget && setAddModal(false)}>
      <div className="modal modal--addprog">
        <div className="modal__title">添加节目</div>
        <div className="addprog-filter">
          <div className="addprog-row">
            <div className="addprog-field"><label>内容分类</label>
              <select className="rule-input" value={q.cat} onChange={(e) => setQ({ ...q, cat: e.target.value })}>
                <option value="">全部</option>
                {FILTER_OPTIONS.CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="addprog-field"><label>内容标签</label>
              <select className="rule-input" value={q.tag} onChange={(e) => setQ({ ...q, tag: e.target.value })}>
                <option value="">全部</option>
                {FILTER_OPTIONS.TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="addprog-field"><label>内容提供方</label>
              <select className="rule-input" value={q.provider} onChange={(e) => setQ({ ...q, provider: e.target.value })}>
                <option value="">全部</option>
                {FILTER_OPTIONS.PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="addprog-row">
            <div className="addprog-field"><label>资源名称</label>
              <input className="rule-input" placeholder="输入资源名称" value={q.name} onChange={(e) => setQ({ ...q, name: e.target.value })} />
            </div>
            <div className="addprog-field"><label>专辑名称</label>
              <input className="rule-input" placeholder="输入专辑名称" value={q.album} onChange={(e) => setQ({ ...q, album: e.target.value })} />
            </div>
            <div className="addprog-btns">
              <button className="btn-o" onClick={() => { const empty = { cat: "", tag: "", provider: "", name: "", album: "" }; setQ(empty); setApplied(empty); }}>重置</button>
              <button className="btn-p" onClick={() => setApplied(q)}>查询</button>
            </div>
          </div>
        </div>

        <div className="addprog-list-wrap">
          <div className="addprog-list-head">
            <label className="addprog-checkall">
              <input type="checkbox"
                checked={enabled.length > 0 && enabled.every((p) => checked.has(p.id))}
                onChange={(e) => setChecked(e.target.checked ? new Set(enabled.map((p) => p.id)) : new Set())}
              /> 全选（仅启用项）
            </label>
            <span className="addprog-tip">已选 <em>{checked.size}</em> 条</span>
          </div>
          <div className="addprog-list">
            {list.map((p) => (
              <label key={p.id} className={`addprog-item ${p.status === "禁用" ? "addprog-item--off" : ""}`}
                style={{ display: "flex", gap: 10, padding: "8px 10px", borderBottom: "1px solid var(--primary-border)", alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" disabled={p.status === "禁用"} checked={checked.has(p.id)} onChange={() => toggle(p.id)} />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ color: "var(--primary-text-light)", fontSize: 12 }}>{p.code} · {p.cat} · {p.provider} · {p.album}</span>
                <span className={`pl-status ${p.status === "启用" ? "pl-status--on" : "pl-status--off"}`}>{p.status}</span>
              </label>
            ))}
            {list.length === 0 && <div className="pl-empty">未找到符合条件的节目，建议放宽筛选条件</div>}
          </div>
        </div>

        <div className="modal__btns">
          <button className="btn-o" onClick={() => setAddModal(false)}>取消</button>
          <button className="btn-p" disabled={!checked.size} onClick={() => addPrograms([...checked])}>添加到播单</button>
        </div>
      </div>
    </div>
  );
}
