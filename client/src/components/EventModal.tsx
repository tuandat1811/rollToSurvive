import type { EventView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { Changes, Formula, Modal, OddsBar, pct, successChance } from './ui.tsx';

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
        </div>
      </div>
      <div className="modal-body">
        <p className="narr">{e.text}</p>
        <Changes changes={e.changes} />
        <div className="section-title" style={{ marginTop: 16 }}>Bạn sẽ làm gì?</div>
        {e.choices.map((c) => (
          <button key={c.id} className="choice" disabled={!c.available || busy} onClick={() => act('choice', { choiceId: c.id })}>
            <span className="t">
              {c.icon} {c.label}
              <span className="spacer" />
              {c.slots > 0 ? <span className="badge time">⏱ {c.slots} buổi</span> : <span className="badge free">⏱ Nhanh</span>}
              {c.energy > 0 && <span className="badge energy">⚡ {c.energy}</span>}
              {c.check && <span className="badge dice">🎲 {pct(successChance(c.check))}</span>}
            </span>
            {c.desc && <span className="small muted">{c.desc}</span>}
            {c.reqs.length > 0 && (
              <span className="small">
                {c.reqs.map((r, i) => (
                  <span key={i} style={{ color: r.met ? 'var(--good)' : 'var(--bad)', marginRight: 10 }}>
                    {r.met ? '✓' : '✗'} {r.label}
                  </span>
                ))}
              </span>
            )}
            {c.check && c.available && (
              <span style={{ width: '100%' }}>
                <Formula check={c.check} />
                <OddsBar check={c.check} />
              </span>
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}
