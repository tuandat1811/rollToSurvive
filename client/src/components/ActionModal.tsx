import type { ActionView } from '../../../shared/types.ts';
import { CheckBox, Modal } from './ui.tsx';

export default function ActionModal({
  action: a,
  busy,
  onClose,
  onConfirm,
}: {
  action: ActionView;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dangerous = a.group === 'escape' && a.id.startsWith('escape');
  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <span className="big">{a.icon}</span>
        <div>
          <h2>{a.name}</h2>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <span className="badge">{a.groupName}</span>
            {a.slots > 0 ? <span className="badge time">⏱ Tốn {a.slots} buổi</span> : <span className="badge free">⏱ Không tốn buổi</span>}
            {a.energy > 0 && <span className="badge energy">⚡ {a.energy} năng lượng</span>}
          </div>
        </div>
      </div>
      <div className="modal-body">
        <p className="muted">{a.desc}</p>
        {a.hint && (
          <p className="small">
            <b>Kết quả mong đợi:</b> {a.hint}
          </p>
        )}

        {a.materials.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 12 }}>Vật liệu tiêu hao</div>
            <div className="mats">
              {a.materials.map((m) => (
                <span key={m.id} className={`mat ${m.have < m.qty ? 'no' : ''}`}>
                  {m.icon} {m.name} {m.have}/{m.qty}
                </span>
              ))}
            </div>
          </>
        )}

        {a.reqs.length > 0 && (
          <ul className="reqs">
            {a.reqs.map((r, i) => (
              <li key={i} className={r.met ? 'ok' : 'no'}>
                {r.met ? '✓' : '✗'} {r.label}
              </li>
            ))}
          </ul>
        )}

        {a.check ? (
          <CheckBox check={a.check} />
        ) : (
          <div className="box small muted">Hành động này không cần tung xúc xắc.</div>
        )}

        {a.notes.length > 0 && (
          <div className="box">
            <div className="section-title">Yếu tố rủi ro</div>
            {a.notes.map((n, i) => (
              <div key={i} className="small">
                • {n}
              </div>
            ))}
          </div>
        )}
        {!a.available && (
          <p style={{ color: 'var(--bad)' }} className="small">
            Chưa thể thực hiện: {a.reasons.join('; ')}
          </p>
        )}
        {a.available && a.check && a.slots > 0 && (
          <p className="tiny faint">Chi phí thời gian, năng lượng và vật liệu sẽ được trừ kể cả khi thất bại.</p>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          Hủy
        </button>
        <button className={`btn ${dangerous ? 'danger' : 'primary'}`} disabled={!a.available || busy} onClick={onConfirm} autoFocus>
          {busy ? 'Đang thực hiện…' : a.check ? '🎲 Thực hiện' : 'Thực hiện'}
        </button>
      </div>
    </Modal>
  );
}
