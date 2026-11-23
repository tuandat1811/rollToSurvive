import type { GameView, ItemView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { Bar } from './ui.tsx';

const VITALS = [
  { id: 'health', name: 'Sức khỏe', icon: '❤️', color: 'var(--health)', hint: 'Về 0 là kết thúc. Hồi phục khi ngủ đủ ăn đủ uống, nghỉ ngơi.' },
  { id: 'hunger', name: 'No bụng', icon: '🍖', color: 'var(--hunger)', hint: 'Giảm dần theo thời gian. Về 0: mất Sức khỏe mỗi buổi.' },
  { id: 'thirst', name: 'Nước', icon: '💧', color: 'var(--thirst)', hint: 'Giảm nhanh, nhất là khi nắng gắt. Về 0: mất Sức khỏe rất nhanh.' },
  { id: 'energy', name: 'Năng lượng', icon: '⚡', color: 'var(--energy)', hint: 'Tiêu hao theo hành động. Hồi khi nghỉ và ngủ. Thấp: kiểm tra bị trừ điểm.' },
] as const;

export default function Vitals({ view, act, guideConsume }: { view: GameView; act: Act; guideConsume?: boolean }) {
  const atBase = view.baseRegion === view.location.id;
  const consumables: (ItemView & { from: 'inv' | 'storage' })[] = [
    ...view.inventory.filter((i) => i.usable).map((i) => ({ ...i, from: 'inv' as const })),
    ...(atBase ? view.storage.filter((i) => i.usable).map((i) => ({ ...i, from: 'storage' as const })) : []),
  ];
  const playing = view.status === 'playing';

  return (
    <>
      <div className="card vitals">
        <div className="section-title">Sinh lực</div>
        {VITALS.map((v) => {
          const val = view.vitals[v.id];
          const cls = val <= 10 ? 'crit' : val < 25 ? 'low' : '';
          return (
            <div key={v.id} className={`vital ${cls}`} title={v.hint}>
              <div className="row">
                <span className="label">
                  {v.icon} {v.name}
                </span>
                <span className="num">{val}</span>
              </div>
              <Bar value={val} color={v.color} />
            </div>
          );
        })}
        {view.conditions.length > 0 && (
          <div className="conds">
            {view.conditions.map((c) => (
              <span key={c.id} className={`cond ${c.good ? 'good' : ''}`} title={c.desc}>
                {c.icon} {c.name}
                {c.treated ? ' 🩹' : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={`card panel ${guideConsume ? 'guided-panel' : ''}`}>
        <div className="row" style={{ marginBottom: 6 }}>
          <div className="section-title" style={{ margin: 0 }}>Ăn uống nhanh</div>
          <div className="spacer" />
          <span className="badge free">Không tốn thời gian</span>
        </div>
        {consumables.length === 0 && <div className="empty">Bạn không có gì để ăn uống.</div>}
        {consumables.map((i, idx) => (
          <div key={`${i.id}-${i.from}-${idx}`} className="item">
            <span className="ic">{i.icon}</span>
            <div>
              <div className="nm">
                {i.name}
                <span className="qty">×{i.qty}</span>
              </div>
              <div className="sub">
                <span>{i.restores}</span>
                {i.from === 'storage' && <span>📦 trong kho</span>}
                {i.spoilsIn !== undefined && <span>{i.spoilsIn <= 1 ? '⚠️ sắp hỏng' : `hỏng sau ${i.spoilsIn} ngày`}</span>}
                {i.risky && <span style={{ color: 'var(--warn)' }}>⚠️ có thể gây bệnh</span>}
              </div>
            </div>
            <button
              className="btn sm"
              disabled={!playing}
              onClick={() => {
                if (i.risky && !confirm(`${i.name} có thể khiến bạn bị bệnh. Vẫn ${i.usable === 'drink' ? 'uống' : 'ăn'}?`)) return;
                act('consume', { itemId: i.id, from: i.from }, { quiet: true });
              }}
            >
              {i.usable === 'drink' ? 'Uống' : 'Ăn'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
