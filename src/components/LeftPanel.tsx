import { useWorkbench } from "../store/workbench";
import RuleDrawer from "./RuleDrawer";

export default function LeftPanel() {
  const { channels, filters, applied, selectedId, setFilter, applyFilters, resetFilters, selectChannel, openRule } =
    useWorkbench();

  const tenants = [...new Set(channels.map((c) => c.tenant))];
  const list = channels.filter(
    (c) =>
      (!applied.name || c.name.includes(applied.name)) &&
      (!applied.tenant || c.tenant === applied.tenant) &&
      (!applied.type || c.type === applied.type) &&
      (!applied.cat || c.cat === applied.cat)
  );

  return (
    <div className="pl-left">
      <div className="pl-panel" style={{ position: "relative" }}>
        <div className="filter-block">
          <div className="filter-bar">
            <input className="filter-input" placeholder="频道名称" value={filters.name}
              onChange={(e) => setFilter("name", e.target.value)} />
            <select className="filter-select" value={filters.tenant} onChange={(e) => setFilter("tenant", e.target.value)}>
              <option value="">租户</option>
              {tenants.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="filter-select" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
              <option value="">频道类型</option>
              <option value="智能频道">智能频道</option>
              <option value="线性频道">线性频道</option>
            </select>
            <select className="filter-select" value={filters.cat} onChange={(e) => setFilter("cat", e.target.value)}>
              <option value="">所属分类</option>
              {["电影", "电视剧", "综艺", "少儿"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="filter-btns">
              <button className="filter-btn filter-btn--reset" onClick={resetFilters}>重置</button>
              <button className="filter-btn filter-btn--query" onClick={applyFilters}>查询</button>
            </div>
          </div>
        </div>

        <div className="pl-channel-list">
          {list.length === 0 && <div className="pl-ch-empty">未找到匹配频道</div>}
          {list.map((c) => (
            <div key={c.id}
              className={`pl-ch-item ${c.type === "线性频道" ? "pl-ch-item--linear" : "pl-ch-item--smart"} ${selectedId === c.id ? "pl-ch-item--active" : ""}`}
              onClick={() => selectChannel(c.id)}>
              <div className="pl-ch-item__name">
                {c.name}
                <span className={`pl-ch-type-tag ${c.type === "线性频道" ? "pl-ch-type-tag--linear" : "pl-ch-type-tag--smart"}`}>
                  {c.type}
                </span>
              </div>
              <div className="pl-ch-item__meta">{c.cat} · {c.tenant}</div>
              <div className="pl-ch-item__foot">
                <span className="pl-ch-item__count">{c.playCount} 条节目单</span>
                <span className="pl-ch-item__rule" onClick={(e) => { e.stopPropagation(); openRule(c.id); }}>
                  配置规则
                </span>
              </div>
            </div>
          ))}
        </div>

        <RuleDrawer />
      </div>
    </div>
  );
}
