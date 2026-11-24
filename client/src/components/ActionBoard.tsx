import { useMemo, useState } from 'react';
import type { ActionView, GameView } from '../../../shared/types.ts';
import { needLabel } from './ui.tsx';

const GROUP_ORDER = ['survival', 'food', 'explore', 'travel', 'craft', 'base', 'medical', 'escape'];
const SCENE: Record<string, string> = { coast: '🏖️', jungle: '🌴', river: '🏞️', mountain: '⛰️', cape: '🗼' };

export function ActionCard({ a, onPick }: { a: ActionView; onPick: (a: ActionView) => void }) {
  return (
    <button className={`action ${a.available ? '' : 'off'} ${a.followUp ? 'followup' : ''}`} onClick={() => onPick(a)}>
      <div className="head">
        <span className="icon">{a.icon}</span>
        <span className="name">{a.name}</span>
      </div>
      {a.hint && <div className="hint">{a.hint}</div>}
      {!a.available && <div className="reason">⛔ {a.reasons[0]}</div>}
      <div className="meta">
        {a.slots > 0 ? <span className="badge time">⏱ {a.slots} buổi</span> : <span className="badge free">⏱ Nhanh</span>}
        {a.energy > 0 && <span className="badge energy">⚡ {a.energy}</span>}
        {a.check && (
          <span className="badge dice" title={`${a.check.attrName}${a.check.skillName ? ' + ' + a.check.skillName : ''} · DC ${a.check.dc}`}>
            🎲 {needLabel(a.check)}
          </span>
        )}
        {a.materials.length > 0 && <span className={`badge ${a.materials.every((m) => m.have >= m.qty) ? '' : 'bad'}`}>🧰 vật liệu</span>}
        {a.untrained && <span className="badge warn" title="Có thể thử, nhưng kiểm tra -5 và có thể thất bại thảm hại">⚠️ Chưa thành thạo</span>}
      </div>
    </button>
  );
}

export default function ActionBoard({ view, onPick }: { view: GameView; onPick: (a: ActionView) => void }) {
  const [group, setGroup] = useState<string>('all');
  const [showLocked, setShowLocked] = useState(true);

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; items: ActionView[] }>();
    for (const a of view.actions) {
      if (!m.has(a.group)) m.set(a.group, { name: a.groupName, items: [] });
      m.get(a.group)!.items.push(a);
    }
    return GROUP_ORDER.filter((g) => m.has(g)).map((g) => ({ id: g, ...m.get(g)! }));
  }, [view.actions]);

  const suggested = useMemo(() => {
    const avail = view.actions.filter((a) => a.available);
    const follow = avail.filter((a) => a.followUp);
    const rest = avail
      .filter((a) => !a.followUp)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, Math.max(3, 6 - follow.length));
    return [...follow.sort((a, b) => b.priority - a.priority), ...rest];
  }, [view.actions]);

  // in a group tab: doable actions first, then the ones still missing something (dimmed, with the reason)
  const byAvail = (items: ActionView[]) => [...items].sort((a, b) => Number(b.available) - Number(a.available));
  const current =
    group === 'suggest' ? suggested : group === 'all' ? view.actions : byAvail(groups.find((g) => g.id === group)?.items ?? []);
  const list = group === 'suggest' || showLocked ? current : current.filter((a) => a.available);
  const lockedCount = current.length - current.filter((a) => a.available).length;
  // "Tất cả": every action, in sections per group (doable first inside each section)
  const sections =
    group === 'all'
      ? groups
          .map((g) => ({ ...g, items: byAvail(g.items).filter((a) => showLocked || a.available) }))
          .filter((g) => g.items.length > 0)
      : [];
  const availCount = view.actions.filter((a) => a.available).length;
  const region = view.map.regions.find((r) => r.here)!;

  return (
    <>
      {view.objective && (
        <div className="card objective">
          <h3>🏕️ {view.objective.title}</h3>
          <p className="small">{view.objective.text}</p>
          <ul className="obj-steps">
            {view.objective.steps.map((st, i) => (
              <li key={i} className={st.done ? 'done' : ''}>
                {st.done ? '✅' : '⬜'} {st.label}
              </li>
            ))}
          </ul>
          <p className="tiny faint">{view.objective.note}</p>
        </div>
      )}
      <div className="card location">
        <div className="scene">{SCENE[view.location.id]}</div>
        <h2>
          {view.location.icon} {view.location.name}
        </h2>
        <div className="desc">{view.location.desc}</div>
        <div className="tags">
          {region.locations.map((l) => (
            <span key={l.id} className={`badge ${l.stateGood === false ? 'bad' : ''}`} title={l.desc}>
              {l.icon} {l.name}
              {l.state && l.stateGood === false ? ` — ${l.state}` : ''}
            </span>
          ))}
          {region.objects.map((o) => (
            <span key={o.uid} className="badge warn" title={o.desc}>
              {o.icon} {o.name}
              {o.daysLeft !== undefined ? ` (còn ~${o.daysLeft} ngày)` : ''}
            </span>
          ))}
          {region.structures.map((s, i) => (
            <span key={i} className="badge good" title={`Độ bền ${s.integrity}%`}>
              {s.icon} {s.name}
              {s.id === 'campfire' ? (s.lit ? ' (đang cháy)' : ' (đã tắt)') : ''}
              {s.unfinished ? ' (vá tạm)' : ''}
            </span>
          ))}
          {region.water && <span className={`badge ${region.water === 'Ô nhiễm!' ? 'bad' : ''}`}>💧 Nước suối: {region.water}</span>}
          {region.unexplored > 0 && <span className="badge warn">🧭 Còn điều chưa khám phá</span>}
        </div>
      </div>

      <div className="card board">
        <div className="chips">
          <button className={`chip ${group === 'all' ? 'on' : ''}`} onClick={() => setGroup('all')}>
            📋 Tất cả hành động
            <span className="n">{availCount}</span>
          </button>
          <button className={`chip ${group === 'suggest' ? 'on' : ''}`} onClick={() => setGroup('suggest')}>
            ⭐ Đề xuất
          </button>
          {groups.map((g) => (
            <button key={g.id} className={`chip ${group === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
              {g.name}
              <span className="n">{g.items.filter((a) => a.available).length}</span>
            </button>
          ))}
        </div>
        {view.status !== 'playing' && <div className="empty">Ván chơi đã kết thúc.</div>}
        {view.status === 'playing' && list.length === 0 && (
          <div className="empty">{view.pending || view.escape ? 'Hãy giải quyết tình huống đang diễn ra.' : 'Không có hành động khả dụng trong nhóm này.'}</div>
        )}
        {group === 'all' ? (
          sections.map((g) => (
            <section key={g.id} className="board-section">
              <div className="section-title">
                {g.name} <span className="faint">· {g.items.filter((a) => a.available).length} có thể làm</span>
              </div>
              <div className="actions-grid">
                {g.items.map((a) => (
                  <ActionCard key={a.key} a={a} onPick={onPick} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="actions-grid">
            {list.map((a) => (
              <ActionCard key={a.key} a={a} onPick={onPick} />
            ))}
          </div>
        )}
        {group !== 'suggest' && lockedCount > 0 && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button className="btn ghost sm" onClick={() => setShowLocked(!showLocked)}>
              {showLocked ? 'Ẩn hành động chưa đủ điều kiện' : `Hiện ${lockedCount} hành động chưa đủ điều kiện`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
