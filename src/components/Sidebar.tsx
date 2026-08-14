export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">✦</div>
          <div className="sidebar__logo-text">Fusion Studio</div>
        </div>
        <div className="sidebar__tagline">AI DIRECTOR × CONTENT UNIVERSE</div>
      </div>
      <div className="sidebar__section">CHANNELS</div>
      {/* 频道管理为二期范围，一期禁用态 */}
      <div className="sidebar__item" style={{ opacity: 0.45, cursor: "not-allowed" }} title="二期开放">
        <span>📺</span><span>频道管理</span>
      </div>
      <div className="sidebar__item sidebar__item--active">
        <span>📋</span><span>播单管理</span>
      </div>
      <div className="sidebar__user">
        <div className="sidebar__avatar">杨</div>
        <div>
          <div className="sidebar__name">杨经理</div>
          <div className="sidebar__role">OPERATOR</div>
        </div>
      </div>
    </aside>
  );
}
