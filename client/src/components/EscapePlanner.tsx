import { useState } from 'react';
import type { ActionView, CheckView, EscapeMethodView, GameView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { CheckBox, Modal, needLabel } from './ui.tsx';

const STATUS: Record<EscapeMethodView['status'], { cls: string; dot: string }> = {
  ready: { cls: 'good', dot: '🟢' },
  waiting: { cls: 'dice', dot: '🟡' },
  not_here: { cls: 'warn', dot: '🟠' },
  locked: { cls: 'bad', dot: '🔴' },
};

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function DifficultyRow({ title, sub, check, owned }: { title: string; sub?: string; check: CheckView; owned?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="esc-row">
      <button className="esc-row-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="esc-row-title">
          {title}
          {sub && <span className="tiny faint"> {sub}</span>}
          {owned === false && <span className="badge bad" style={{ marginLeft: 6 }}>Chưa có</span>}
          {owned === true && <span className="badge good" style={{ marginLeft: 6 }}>Đã có</span>}
        </span>
        <span className="badge dice">🎲 {needLabel(check)}</span>
        <span className="tiny faint">
          DC {check.dc} · cộng {sign(check.totalMod)}
        </span>
        <span className="tiny faint">{open ? '▲' : '▼'}</span>
      </button>
      {open && <CheckBox check={check} compact />}
    </div>
  );
}

export default function EscapePlanner({
  view,
  busy,
  act,
  initial,
  onClose,
  onPickAction,
}: {
  view: GameView;
  busy: boolean;
  act: Act;
  initial?: EscapeMethodView['id'];
  onClose: () => void;
  onPickAction: (a: ActionView) => void;
}) {
  const methods = view.escapePlan.methods;
  const [sel, setSel] = useState<EscapeMethodView['id']>(initial ?? methods.find((m) => m.status === 'ready')?.id ?? 'raft');
  const [confirming, setConfirming] = useState(false);
  const m = methods.find((x) => x.id === sel)!;
  const travel = m.travelKey ? view.actions.find((a) => a.key === m.travelKey) : undefined;
  const playing = view.status === 'playing' && !view.escape && !view.pending;

  return (
    <Modal onClose={onClose} wide className="escape-planner">
      <div className="event-art escape" style={{ height: 96, fontSize: 48 }}>
        ⛵
      </div>
      <div className="modal-head">
        <div>
          <h2>Thoát đảo</h2>
          <div className="small muted">Ba cách rời khỏi hòn đảo. Hãy đọc kỹ độ khó và cái giá của thất bại trước khi quyết định.</div>
        </div>
      </div>
      <div className="modal-body">
        <div className="chips esc-tabs">
          {methods.map((x) => (
            <button
              key={x.id}
              className={`chip ${x.id === sel ? 'on' : ''}`}
              onClick={() => {
                setSel(x.id);
                setConfirming(false);
              }}
            >
              {x.icon} {x.name} <span className="n">{STATUS[x.status].dot}</span>
            </button>
          ))}
        </div>

        <div className="row wrap" style={{ marginBottom: 8 }}>
          <span className={`badge ${STATUS[m.status].cls}`}>
            {STATUS[m.status].dot} {m.statusText}
          </span>
          <span className="badge time">⏱ {m.timeCost}</span>
        </div>
        <p className="muted">{m.summary}</p>

        <div className="section-title" style={{ marginTop: 12 }}>Yêu cầu</div>
        <ul className="reqs">
          {m.reqs.map((r, i) => (
            <li key={i} className={r.met ? 'ok' : 'no'}>
              {r.met ? '✓' : '✗'} {r.label}
            </li>
          ))}
        </ul>

        <div className="section-title" style={{ marginTop: 12 }}>
          Độ khó {m.stages ? '— phải vượt lần lượt từng chặng' : '— mỗi cách ra hiệu là một lần tung'}
        </div>
        <div className="esc-rows">
          {m.stages?.map((st, i) => (
            <DifficultyRow key={i} title={`Chặng ${i + 1}: ${st.name}`} sub={st.desc} check={st.check} />
          ))}
          {m.signals?.map((sg) => (
            <DifficultyRow key={sg.id} title={`${sg.icon} ${sg.name}`} check={sg.check} owned={sg.id === 'wave' ? undefined : sg.owned} />
          ))}
        </div>
        <div className="tiny faint" style={{ marginTop: 4 }}>
          Bấm vào từng dòng để xem bảng điểm đầy đủ và các yếu tố cộng/trừ. Độ khó tính theo tình trạng, thời tiết và vị trí hiện tại.
        </div>

        {m.info.length > 0 && (
          <div className="box small">
            {m.info.map((t, i) => (
              <div key={i}>• {t}</div>
            ))}
          </div>
        )}

        <div className="esc-penalty">
          <div className="section-title" style={{ color: 'var(--bad)' }}>
            ⚠️ Nếu thất bại
          </div>
          <ul>
            {m.penalties.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onClose}>
          Đóng
        </button>
        {playing && !m.actionKey && travel && (
          <button className="btn" onClick={() => onPickAction(travel)}>
            {travel.icon} {travel.name}
          </button>
        )}
        {playing && m.actionKey && !confirming && (
          <button className="btn danger esc-go" onClick={() => setConfirming(true)}>
            {m.icon} Bắt đầu: {m.name}
          </button>
        )}
        {playing && m.actionKey && confirming && (
          <>
            <span className="small" style={{ color: 'var(--bad)', alignSelf: 'center' }}>
              Đã ra khơi thì {m.id === 'raft' ? 'chỉ quay về được sau khi vượt hoặc thất bại một chặng' : 'không thể quay đầu'}. Chắc chắn?
            </span>
            <button className="btn" onClick={() => setConfirming(false)}>
              Chưa
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                const ok = await act('action', { key: m.actionKey });
                if (ok) onClose();
              }}
            >
              {busy ? 'Đang ra khơi…' : 'Ra khơi ngay'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
