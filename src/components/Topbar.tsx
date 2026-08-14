import { useWorkbench } from "../store/workbench";

export default function Topbar() {
  const { apiMode } = useWorkbench();
  return (
    <>
      <header className="topbar">
        <div className="topbar__left">
          <div className="topbar__icon">✦</div>
          <span className="topbar__name">Fusion Studio</span>
        </div>
        <div className="topbar__right">
          <div className="topbar__ai"><span className="topbar__dot"></span>AI ASSISTANT ONLINE</div>
          <div style={{ fontSize: 12, color: "var(--primary-text-light)", alignSelf: "center" }}>
            {apiMode === null ? "后端探测中…" : apiMode ? "API 已连接" : "演示模式（后端未连接）"}
          </div>
          <div className="topbar__user">YJ</div>
        </div>
      </header>
      <nav className="crumb">
        <a href="#">CHANNELS</a><span className="crumb__sep">/</span><span className="crumb__now">播单管理</span>
      </nav>
    </>
  );
}
