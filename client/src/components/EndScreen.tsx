import type { GameView } from '../../../shared/types.ts';
import { Modal } from './ui.tsx';

export default function EndScreen({ view, onExit, onNew, onClose }: { view: GameView; onExit: () => void; onNew: () => void; onClose: () => void }) {
  const win = view.status === 'victory';
  const e = view.ending;
  return (
    <Modal>
      <div className={`ending ${win ? 'win' : 'lose'}`}>
        <div className="big">{win ? '🏆' : '🪦'}</div>
        <h2>{e?.title ?? (win ? 'Thoát đảo!' : 'Kết thúc')}</h2>
        <p className="narr">{e?.text}</p>
        <div className="stats">
          <div>
            <b>{view.day}</b>
            <span className="small muted">ngày sống sót</span>
          </div>
          <div>
            <b>{view.stats.checks}</b>
            <span className="small muted">lần tung D20</span>
          </div>
          <div>
            <b>{view.stats.crits}</b>
            <span className="small muted">thành công vang dội</span>
          </div>
          <div>
            <b>{view.stats.critFails}</b>
            <span className="small muted">thất bại thảm hại</span>
          </div>
          <div>
            <b>{view.stats.events}</b>
            <span className="small muted">sự kiện</span>
          </div>
          <div>
            <b>{view.skills.reduce((a, s) => a + s.lvl, 0)}</b>
            <span className="small muted">tổng cấp kỹ năng</span>
          </div>
        </div>
      </div>
      <div className="modal-foot" style={{ justifyContent: 'center' }}>
        <button className="btn ghost" onClick={onClose}>
          Xem lại nhật ký
        </button>
        <button className="btn" onClick={onExit}>
          Trang chủ
        </button>
        <button className="btn primary" onClick={onNew}>
          Ván mới
        </button>
      </div>
    </Modal>
  );
}
