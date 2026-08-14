import { useState } from "react";
import { useWorkbench, PAGE_SIZE } from "../store/workbench";
import { fmtLinearDisplay } from "../mock/data";

export default function MiddlePanel() {
  const {
    channels, selectedId, playlists, page, version,
    setPage, setAddModal, clearPlaylist, deleteItem, moveItem,
  } = useWorkbench();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<number, string>>({});

  const ch = channels.find((c) => c.id === selectedId) || null;
  const isLinear = ch?.type === "线性频道";
  const items = ch ? playlists[ch.id] || [] : [];
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // C8：移至第 N 位（全播单序号 1 起 → move 接口 0 基索引）
  const moveToN = (globalIdx: number) => {
    const raw = moveTarget[globalIdx];
    const n = parseInt(raw ?? "", 10);
    if (!Number.isFinite(n) || n < 1 || n > items.length || n === globalIdx + 1) return;
    moveItem(globalIdx, n - 1);
    setMoveTarget((s) => ({ ...s, [globalIdx]: "" }));
  };

  return (
    <div className="pl-middle">
      <div className="pl-middle__head">
        <div className="pl-middle__title">
          <span>{ch ? ch.name : "请选择左侧频道"}</span>
          {ch && <span className="pl-version">v{version} · 共 {items.length} 条</span>}
        </div>
        <div className="pl-middle__btns">
          <button className="btn-o" disabled={!ch || !items.length} onClick={clearPlaylist}>清空</button>
          <button className="btn-p" disabled={!ch} onClick={() => setAddModal(true)}>+ 添加节目</button>
        </div>
      </div>

      {/* C7：频道信息条（docx 节目单列表验收：名称/租户/类型/调度规则/已编排节目数） */}
      {ch && (
        <div className="pl-chinfo">
          <span>租户：{ch.tenant}</span>
          <span>类型：{ch.type}</span>
          <span>分类：{ch.cat}</span>
          <span>调度规则：{ch.type === "线性频道" ? "24h 时间轴顺排" : "智能推荐"}</span>
          <span>已编排：{items.length} 条</span>
        </div>
      )}

      <div className="pl-table-wrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>排序</th>
              {isLinear && <th style={{ width: 200 }}>播出时间</th>}
              <th>节目名称</th>
              <th style={{ width: 180 }}>所属专辑</th>
              <th style={{ width: 100 }}>状态</th>
              <th style={{ width: 140 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!ch && <tr><td colSpan={6} className="pl-empty">请先在左侧选择频道</td></tr>}
            {ch && items.length === 0 && <tr><td colSpan={6} className="pl-empty">暂无节目，可通过 AI 生成或手动添加</td></tr>}
            {ch && pageItems.map((it, idx) => {
              const globalIdx = (page - 1) * PAGE_SIZE + idx;
              return (
                <tr key={it.id} draggable
                  className={dragOver === globalIdx ? "drag-over" : ""}
                  onDragStart={() => setDragFrom(globalIdx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(globalIdx); }}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                  onDrop={() => {
                    if (dragFrom !== null && dragFrom !== globalIdx) moveItem(dragFrom, globalIdx);
                    setDragFrom(null); setDragOver(null);
                  }}>
                  <td><span className="pl-row-idx">{it.sort}</span></td>
                  {isLinear && (
                    <td className="pl-time">{fmtLinearDisplay(it.timeStart)} - {fmtLinearDisplay(it.timeEnd)}</td>
                  )}
                  <td>{it.name}</td>
                  <td>{it.album}</td>
                  <td><span className={`pl-status ${it.status === "启用" ? "pl-status--on" : "pl-status--off"}`}>{it.status}</span></td>
                  <td>
                    <span className="pl-row-action" onClick={() => deleteItem(it.id)}>删除</span>
                    {/* C8：跨页调序兜底 */}
                    <input
                      className="pl-move-to"
                      placeholder="移至"
                      title="移至第 N 位（全播单序号）"
                      value={moveTarget[globalIdx] ?? ""}
                      onChange={(e) => setMoveTarget((s) => ({ ...s, [globalIdx]: e.target.value.replace(/\D/g, "") }))}
                      onKeyDown={(e) => e.key === "Enter" && moveToN(globalIdx)}
                      onBlur={() => moveToN(globalIdx)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pl-pagination">
        {Array.from({ length: totalPages }, (_, i) => (
          <button key={i} className={page === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
