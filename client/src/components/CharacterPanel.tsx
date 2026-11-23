import type { GameView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { Bar } from './ui.tsx';

export default function CharacterPanel({ view, act }: { view: GameView; act: Act }) {
  const playing = view.status === 'playing';
  return (
    <div className="card panel">
      <div className="row" style={{ marginBottom: 6 }}>
        <div className="section-title" style={{ margin: 0 }}>🧍 {view.name}</div>
        <div className="spacer" />
        {view.attrPoints > 0 && <span className="badge dice">⭐ {view.attrPoints} điểm chưa dùng</span>}
      </div>
      {view.attrs.map((a) => (
        <div key={a.id} className="attr-line" title={a.desc}>
          <span>
            {a.name} <span className="faint tiny">{a.id}</span>
          </span>
          <span className="v">{a.value}</span>
          {view.attrPoints > 0 && playing ? (
            <button className="btn sm primary" disabled={a.value >= view.attrMax} onClick={() => act('attr', { attr: a.id }, { quiet: true })}>
              +1
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <p className="tiny faint" style={{ margin: '4px 0 12px' }}>
        Thuộc tính tăng khi bạn sống sót qua các mốc ngày (3, 6, 10, 15, 21…).
      </p>
      <div className="section-title">Kỹ năng</div>
      {view.skills.map((s) => (
        <div key={s.id} className="skill" title={s.desc}>
          <div className="row">
            <span>
              {s.icon} {s.name}
            </span>
            <b>Cấp {s.lvl}</b>
          </div>
          {s.next > 0 ? <Bar value={s.xp} max={s.next} color="var(--sea-2)" /> : <Bar value={1} max={1} color="var(--sand)" />}
          {s.perks
            .filter((p) => p.unlocked || p.lvl === s.lvl + 1)
            .map((p) => (
              <div key={p.lvl} className={`perk ${p.unlocked ? 'on' : ''}`}>
                {p.unlocked ? '✓' : `Cấp ${p.lvl}:`} {p.text}
              </div>
            ))}
        </div>
      ))}
      <p className="tiny faint">Kỹ năng tăng khi bạn thực hiện thử thách — việc quá dễ lặp đi lặp lại sẽ ít kinh nghiệm hơn.</p>
    </div>
  );
}
