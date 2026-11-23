import type { GameView, ItemView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { Bar } from './ui.tsx';

const KIND_NAMES: Record<string, string> = {
  water: 'Nước',
  food: 'Thức ăn',
  medical: 'Y tế',
  tool: 'Công cụ & trang bị',
  special: 'Vật phẩm đặc biệt',
  material: 'Vật liệu',
};

function ItemList({ items, atBase, from, act, playing }: { items: ItemView[]; atBase: boolean; from: 'inv' | 'storage'; act: Act; playing: boolean }) {
  if (!items.length) return <div className="empty">{from === 'inv' ? 'Hành trang trống.' : 'Kho trống.'}</div>;
  let lastKind = '';
  return (
    <>
      {items.map((i, idx) => {
        const header = i.kind !== lastKind ? <div className="kind-h">{KIND_NAMES[i.kind] ?? i.kind}</div> : null;
        lastKind = i.kind;
        const canUse = playing && i.usable && (from === 'inv' || atBase);
        return (
          <div key={`${i.id}-${idx}`}>
            {header}
            <div className="item" title={i.desc}>
              <span className="ic">{i.icon}</span>
              <div>
                <div className="nm">
                  {i.name}
                  <span className="qty">×{i.qty}</span>
                </div>
                <div className="sub">
                  {i.restores && <span>{i.restores}</span>}
                  {i.spoilsIn !== undefined && <span style={{ color: i.spoilsIn <= 1 ? 'var(--warn)' : undefined }}>⏳ {i.spoilsIn <= 0 ? 'hỏng đêm nay' : `${i.spoilsIn} ngày`}</span>}
                  {i.dur !== undefined && i.maxDur !== undefined && <span>🔧 {i.dur}/{i.maxDur}</span>}
                  {i.risky && <span style={{ color: 'var(--warn)' }}>⚠️ chưa an toàn</span>}
                  <span>⚖️ {Math.round(i.weight * i.qty * 10) / 10}</span>
                </div>
              </div>
              <div className="acts">
                {canUse && (
                  <button
                    className="btn sm"
                    onClick={() => {
                      if (i.risky && !confirm(`${i.name} có thể khiến bạn bị bệnh. Vẫn ${i.usable === 'drink' ? 'uống' : 'ăn'}?`)) return;
                      act('consume', { itemId: i.id, from }, { quiet: true });
                    }}
                  >
                    {i.usable === 'drink' ? 'Uống' : 'Ăn'}
                  </button>
                )}
                {playing && atBase && (
                  <button
                    className="btn sm"
                    title={from === 'inv' ? 'Cất vào kho' : 'Lấy ra mang theo'}
                    onClick={() => act('transfer', { itemId: i.id, qty: i.qty, dir: from === 'inv' ? 'store' : 'take' }, { quiet: true })}
                  >
                    {from === 'inv' ? '📦 Cất' : '🎒 Lấy'}
                  </button>
                )}
                {playing && from === 'inv' && (
                  <button
                    className="btn ghost sm"
                    title="Bỏ 1"
                    onClick={() => confirm(`Bỏ 1 ${i.name}?`) && act('drop', { itemId: i.id, qty: 1 }, { quiet: true })}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function InventoryPanel({ view, act }: { view: GameView; act: Act }) {
  const atBase = view.baseRegion === view.location.id;
  const playing = view.status === 'playing';
  const baseName = view.map.regions.find((r) => r.id === view.baseRegion)?.name;
  return (
    <>
      <div className="card panel">
        <div className="section-title">🎒 Mang theo</div>
        <div className="small row" style={{ justifyContent: 'space-between' }}>
          <span>Khối lượng</span>
          <span>
            {view.carry.weight} / {view.carry.max}
          </span>
        </div>
        <Bar value={view.carry.weight} max={view.carry.max} color={view.carry.weight / view.carry.max > 0.9 ? 'var(--warn)' : 'var(--sand)'} />
        <div className="small row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <span>Nước trong bình chứa</span>
          <span>
            {view.water.carried} / {view.water.cap}
          </span>
        </div>
        <Bar value={view.water.carried} max={Math.max(1, view.water.cap)} color="var(--thirst)" />
        <div style={{ marginTop: 6 }}>
          <ItemList items={view.inventory} atBase={atBase} from="inv" act={act} playing={playing} />
        </div>
      </div>
      <div className="card panel">
        <div className="section-title">📦 Kho căn cứ{baseName ? ` — ${baseName}` : ''}</div>
        {!view.baseRegion && <div className="empty">Chưa có căn cứ. Xây Lều tạm để lập căn cứ và cất đồ.</div>}
        {view.baseRegion && !atBase && <p className="small faint">Bạn chỉ dùng được đồ trong kho khi ở căn cứ.</p>}
        {view.baseRegion && (
          <>
            {view.water.storeCap > 0 && (
              <div className="small muted">
                Nước trong kho: {view.water.stored} / {view.water.storeCap}
              </div>
            )}
            <ItemList items={view.storage} atBase={atBase} from="storage" act={act} playing={playing} />
          </>
        )}
      </div>
    </>
  );
}
