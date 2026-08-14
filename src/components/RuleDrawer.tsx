import { useState } from "react";
import { useWorkbench } from "../store/workbench";
import { FILTER_OPTIONS } from "../mock/data";

const TABS = [
  { key: "movie", label: "电影" },
  { key: "album", label: "专辑" },
  { key: "drama", label: "剧集" },
];

function MSelect({ options }: { options: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="rule-mselect">
      <div className="rule-mselect__box" onClick={() => setOpen(!open)}>
        {selected.length ? (
          selected.map((s) => <span key={s} className="rule-mselect__tag">{s}</span>)
        ) : (
          <span className="rule-mselect__placeholder">请选择（可多选）</span>
        )}
        <span className="rule-mselect__caret">▾</span>
      </div>
      {open && (
        <div className="rule-mselect__dropdown" style={{ display: "block" }}>
          {options.map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o))
                }
              />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rule-row"><label>{label}</label>{children}</div>;
}

export default function RuleDrawer() {
  const { ruleDrawerFor, closeRule, channels } = useWorkbench();
  const [tab, setTab] = useState("movie");
  const ch = channels.find((c) => c.id === ruleDrawerFor);
  if (!ch) return null;

  return (
    <div className="rule-drawer show">
      <div className="rule-drawer__head">
        <div className="rule-drawer__title">配置规则 — {ch.name}</div>
        <button className="rule-drawer__close" onClick={closeRule}>×</button>
      </div>
      <div className="rule-tabs">
        {TABS.map((t) => (
          <div key={t.key} className={`rule-tab ${tab === t.key ? "rule-tab--on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>
      <div className="rule-body">
        {tab === "movie" && (
          <div className="rule-pane rule-pane--on"><div className="rule-form">
            <Row label="电影ID"><input className="rule-input" placeholder="请输入电影ID" /></Row>
            <Row label="电影名称"><input className="rule-input" placeholder="请输入电影名称" /></Row>
            <Row label="标签"><div className="rule-tags"><div className="rule-tags__input"><input placeholder="输入标签后回车" /><button>添加</button></div></div></Row>
            <Row label="内容提供方"><MSelect options={FILTER_OPTIONS.PROVIDERS} /></Row>
            <Row label="导演"><input className="rule-input" placeholder="请输入导演" /></Row>
            <Row label="演员"><input className="rule-input" placeholder="请输入演员" /></Row>
            <Row label="付费状态"><div className="rule-radio"><label><input type="radio" name="m_pay" />免费</label><label><input type="radio" name="m_pay" />付费</label></div></Row>
            <Row label="运营标签"><input className="rule-input" placeholder="请输入运营标签" /></Row>
            <Row label="获取最大数量"><input className="rule-input" type="number" min={1} placeholder="请输入数字" /></Row>
          </div></div>
        )}
        {tab === "album" && (
          <div className="rule-pane rule-pane--on"><div className="rule-form">
            <Row label="专辑ID"><input className="rule-input" placeholder="请输入专辑ID" /></Row>
            <Row label="专辑名称"><input className="rule-input" placeholder="请输入专辑名称" /></Row>
            <Row label="内容提供方"><MSelect options={FILTER_OPTIONS.PROVIDERS} /></Row>
            <Row label="一级分类"><div className="rule-radio">{FILTER_OPTIONS.CATS.map((c) => <label key={c}><input type="radio" name="a_cat" />{c}</label>)}</div></Row>
            <Row label="导演"><input className="rule-input" placeholder="请输入导演" /></Row>
            <Row label="演员"><input className="rule-input" placeholder="请输入演员" /></Row>
            <Row label="付费状态"><div className="rule-radio"><label><input type="radio" name="a_pay" />免费</label><label><input type="radio" name="a_pay" />付费</label></div></Row>
          </div></div>
        )}
        {tab === "drama" && (
          <div className="rule-pane rule-pane--on"><div className="rule-form">
            <Row label="剧集ID"><input className="rule-input" placeholder="请输入剧集ID" /></Row>
            <Row label="剧集名称"><input className="rule-input" placeholder="请输入剧集名称" /></Row>
            <Row label="内容提供方"><MSelect options={FILTER_OPTIONS.PROVIDERS} /></Row>
            <Row label="付费状态"><div className="rule-radio"><label><input type="radio" name="d_pay" />免费</label><label><input type="radio" name="d_pay" />付费</label></div></Row>
            <Row label="获取最大数量"><input className="rule-input" type="number" min={1} placeholder="请输入数字" /></Row>
          </div></div>
        )}
      </div>
      <div className="rule-drawer__btns">
        <button className="btn-o" onClick={closeRule}>取消</button>
        <button className="btn-p" onClick={closeRule}>确定</button>
      </div>
    </div>
  );
}
