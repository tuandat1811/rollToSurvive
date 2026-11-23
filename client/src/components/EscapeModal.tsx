import type { GameView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { CheckBox, Modal } from './ui.tsx';

export default function EscapeModal({ view, busy, act }: { view: GameView; busy: boolean; act: Act }) {
  const e = view.escape!;
  const st = e.stages[e.stage];
  return (
    <Modal wide>
      <div className="event-art escape">{e.method === 'raft' ? '⛵' : '🌊'}</div>
      <div className="modal-head">
        <div>
          <h2>{e.method === 'raft' ? 'Hành trình trên bè' : 'Liều mình giữa biển khơi'}</h2>
          <div className="small muted">Mỗi chặng tốn một buổi. Vượt qua cả 3 chặng để thoát khỏi hòn đảo.</div>
        </div>
      </div>
      <div className="modal-body">
        <div className="journey">
          {e.stages.map((s, i) => (
            <div key={i} style={{ display: 'contents' }}>
              {i > 0 && <div className={`seg ${i <= e.stage ? 'done' : ''}`} />}
              <div className={`stop ${i < e.stage ? 'done' : i === e.stage ? 'now' : ''}`} title={s.name}>
                {i < e.stage ? '✓' : i + 1}
              </div>
            </div>
          ))}
          <div className="seg" />
          <div className="stop" title="Đất liền">🏁</div>
        </div>
        <h3 style={{ fontSize: 18 }}>
          Chặng {e.stage + 1}: {st.name}
        </h3>
        <p className="muted">{st.desc}</p>
        <CheckBox check={e.check} />
        {e.notes.length > 0 && (
          <div className="box">
            {e.notes.map((n, i) => (
              <div key={i} className="small">
                • {n}
              </div>
            ))}
          </div>
        )}
        <p className="tiny faint">
          {e.method === 'raft'
            ? 'Thất bại sẽ làm bè hư hại và có thể gây thương tích. Nếu bè vỡ, bạn sẽ bị sóng đánh dạt về bờ.'
            : 'Không có bè — bất kỳ kết quả nào kém hơn "Thành công" đều khiến bạn bị sóng đánh dạt về bờ.'}
        </p>
      </div>
      <div className="modal-foot">
        {e.canReturn && (
          <button className="btn" disabled={busy} onClick={() => act('escape', { decision: 'return' })}>
            🏝️ Quay về đảo
          </button>
        )}
        <button className="btn primary" disabled={busy} onClick={() => act('escape', { decision: 'roll' })} autoFocus>
          🎲 {busy ? 'Đang tung…' : `Vượt chặng ${e.stage + 1}`}
        </button>
      </div>
    </Modal>
  );
}
