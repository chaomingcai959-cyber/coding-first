import { useWorkbench } from "../store/workbench";

// 统一确认弹窗（B6：替代原生 confirm；删除/清空/全覆盖/开启新规则共用）
export default function ConfirmModal() {
  const { confirm, closeConfirm } = useWorkbench();
  if (!confirm.open) return null;
  return (
    <div className="modal-mask show">
      <div className="modal modal--confirm">
        <div className="modal__title">{confirm.title}</div>
        <div className="modal__text">{confirm.text}</div>
        <div className="modal__btns">
          <button className="btn-o" onClick={closeConfirm}>取消</button>
          <button className={confirm.danger ? "btn-danger" : "btn-p"} onClick={confirm.onOk}>确认</button>
        </div>
      </div>
    </div>
  );
}
