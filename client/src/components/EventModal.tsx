import type { EventView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { Changes, CheckBox, Modal, needLabel } from './ui.tsx';

const RISK = ['', 'Nhỏ', 'Vừa', 'Nghiêm trọng', 'Thảm họa'];

export default function EventModal({ event: e, busy, act }: { event: EventView; busy: boolean; act: Act }) {
  return (
    <Modal wide>
      <div className={`event-art ${e.category}`}>
        {e.icon}
        <span className={`badge risk ${e.risk >= 3 ? 'bad' : e.risk === 2 ? 'warn' : ''}`}>Rủi ro: {RISK[e.risk]}</span>
      </div>
      <div className="modal-head">
        <div>
          <h2>{e.title}</h2>
          {e.code && (
            <div className="row wrap" style={{ marginTop: 6 }}>
              {e.source === 'action' && <span className="badge">Do hành động của bạn</span>}
              {e.source === 'persistent' && <span className="badge">Hệ quả từ trước</span>}
              {e.rarity === 'rare' && <span className="badge warn">Hiếm</span>}
              <span className="badge code">{e.code}</span>
            </div>
          )}
        </div>
      </div>
      <div className="modal-body">
        <p className="narr">{e.text}</p>
        <Changes changes={e.changes} />
        <div className="section-title" style={{ marginTop: 16 }}>Bạn sẽ làm gì?</div>
        {e.choices.map((c) => (
          <div key={c.id} className={`choice ${c.available ? '' : 'off'}`}>
            <div className="t">
              {c.icon} {c.label}
              <span className="spacer" />
              {c.slots > 0 ? <span className="badge time">⏱ {c.slots} buổi</span> : <span className="badge free">⏱ Nhanh</span>}
              {c.energy > 0 && <span className="badge energy">⚡ {c.energy}</span>}
              {c.check ? <span className="badge dice">🎲 {needLabel(c.check)}</span> : <span className="badge">Không tung xúc xắc</span>}
            </div>
            {c.desc && <div className="small muted">{c.desc}</div>}
            {c.reqs.length > 0 && (
              <div className="small">
                {c.reqs.map((r, i) => (
                  <span key={i} style={{ color: r.met ? 'var(--good)' : 'var(--bad)', marginRight: 10 }}>
                    {r.met ? '✓' : '✗'} {r.label}
                  </span>
                ))}
              </div>
            )}
            {c.check && c.available && <CheckBox check={c.check} compact />}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary sm" disabled={!c.available || busy} onClick={() => act('choice', { choiceId: c.id })}>
                {c.check ? '🎲 Chọn và tung xúc xắc' : 'Chọn'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
