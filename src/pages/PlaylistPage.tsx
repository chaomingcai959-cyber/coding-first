import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import LeftPanel from "../components/LeftPanel";
import MiddlePanel from "../components/MiddlePanel";
import AIPanel from "../components/AIPanel";
import AddProgramModal from "../components/AddProgramModal";
import ConfirmModal from "../components/ConfirmModal";
import { useWorkbench } from "../store/workbench";
import { probeBackend } from "../api/health";

export default function PlaylistPage() {
  const { setApiMode, initRemote, banner, dismissBanner } = useWorkbench();

  // 启动时探测后端：连通进入 API 模式并加载远端频道（规格 05 §2）
  useEffect(() => {
    probeBackend().then(async (ok) => {
      setApiMode(ok);
      if (ok) await initRemote();
    });
  }, [setApiMode, initRemote]);

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        {/* B13：播单已更新 / 锁释放 / 错误提示横幅，点击关闭 */}
        {banner && (
          <div className="wb-banner" onClick={dismissBanner}>
            {banner} <span style={{ marginLeft: 8, opacity: 0.6 }}>✕</span>
          </div>
        )}
        <div className="main__body">
          <div className="edit-wrap playlist-wrap">
            <LeftPanel />
            <MiddlePanel />
            <AIPanel />
          </div>
        </div>
      </div>
      <AddProgramModal />
      <ConfirmModal />
    </div>
  );
}
