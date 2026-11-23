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
      </div>
    </button>
  );
}

export default function ActionBoard({ view, onPick }: { view: GameView; onPick: (a: ActionView) => void }) {
  const [group, setGroup] = useState<string>('suggest');
  const [showLocked, setShowLocked] = useState(false);

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

  const current = group === 'suggest' ? suggested : groups.find((g) => g.id === group)?.items ?? [];
  const list = group === 'suggest' || showLocked ? current : current.filter((a) => a.available);
  const lockedCount = current.length - current.filter((a) => a.available).length;
  const region = view.map.regions.find((r) => r.here)!;

  return (
    <>
      <div className="card location">
        <div className="scene">{SCENE[view.location.id]}</div>
        <h2>
          {view.location.icon} {view.location.name}
        </h2>
        <div className="desc">{view.location.desc}</div>
        <div className="tags">
          {region.locations.map((l) => (
            <span key={l.id} className="badge" title={l.desc}>
              {l.icon} {l.name}
            </span>
          ))}
          {region.structures.map((s, i) => (
            <span key={i} className="badge good" title={`Độ bền ${s.integrity}%`}>
              {s.icon} {s.name}
              {s.id === 'campfire' ? (s.lit ? ' (đang cháy)' : ' (đã tắt)') : ''}
            </span>
          ))}
          {region.water && <span className={`badge ${region.water === 'Ô nhiễm!' ? 'bad' : ''}`}>💧 Nước suối: {region.water}</span>}
          {region.unexplored > 0 && <span className="badge warn">🧭 Còn điều chưa khám phá</span>}
        </div>
      </div>

      <div className="card board">
        <div className="chips">
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
        <div className="actions-grid">
          {list.map((a) => (
            <ActionCard key={a.key} a={a} onPick={onPick} />
          ))}
        </div>
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
