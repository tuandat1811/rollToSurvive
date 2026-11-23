import type { GameView } from '../../../shared/types.ts';
import { Bar } from './ui.tsx';

export default function BasePanel({ view }: { view: GameView }) {
  const base = view.map.regions.find((r) => r.id === view.baseRegion);
  const elsewhere = view.map.regions.filter((r) => r.id !== view.baseRegion && r.structures.length);
  const k = view.knowledge;
  return (
    <>
      <div className="card panel">
        <div className="section-title">⛺ Căn cứ</div>
        {!base && <div className="empty">Chưa có căn cứ. Hãy xây Lều tạm ở nơi bạn muốn định cư — gần nguồn nước là lựa chọn khôn ngoan.</div>}
        {base && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {base.icon} {base.name}
            </div>
            {base.structures.map((s, i) => (
              <div key={i} className="item" style={{ gridTemplateColumns: '30px 1fr 90px' }}>
                <span className="ic">{s.icon}</span>
                <div className="nm">
                  {s.name}
                  {s.id === 'campfire' && <span className="small faint"> {s.lit ? '· đang cháy' : '· đã tắt'}</span>}
                </div>
                <Bar value={s.integrity} color={s.integrity < 40 ? 'var(--bad)' : 'var(--sea-2)'} />
              </div>
            ))}
          </>
        )}
        {elsewhere.map((r) =>
          r.structures.map((s, i) => (
            <div key={`${r.id}${i}`} className="item" style={{ gridTemplateColumns: '30px 1fr 90px' }}>
              <span className="ic">{s.icon}</span>
              <div className="nm">
                {s.name} <span className="small faint">· {r.name}</span>
              </div>
              <Bar value={s.integrity} color={s.integrity < 40 ? 'var(--bad)' : 'var(--sea-2)'} />
            </div>
          )),
        )}
        {view.traps.length > 0 && (
          <>
            <div className="kind-h">Bẫy đã đặt</div>
            {view.traps.map((t, i) => (
              <div key={i} className="small" style={{ padding: '2px 8px' }}>
                {t.kind === 'snare' ? '🪤 Bẫy thú' : '🧺 Bẫy cá'} · {t.region} · {t.ready ? <b style={{ color: 'var(--good)' }}>sẵn sàng thu</b> : 'đang chờ'}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card panel">
        <div className="section-title">⛵ Kế hoạch thoát đảo</div>
        {view.raft ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>🛶 Bè ({view.raft.stage}/3 giai đoạn)</b>
              <span className="small">Độ bền {view.raft.integrity}%</span>
            </div>
            <Bar value={view.raft.integrity} color={view.raft.integrity < 40 ? 'var(--bad)' : 'var(--sea-2)'} />
            <div className="small" style={{ marginTop: 6 }}>
              {view.raft.stages.map((s, i) => (
                <div key={s} style={{ color: i < view.raft!.stage ? 'var(--good)' : 'var(--text-faint)' }}>
                  {i < view.raft!.stage ? '✓' : '○'} {s}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="small faint">Chưa có bè. Đóng bè tại Bãi biển (cần gỗ và dây thừng).</div>
        )}
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>🧭 Hải lưu</dt>
          <dd>{k.currents}/3 {k.currents === 0 ? '— chưa hiểu gì' : k.currents === 3 ? '— nắm rõ' : ''}</dd>
          <dt>🚢 Tàu kế tiếp</dt>
          <dd>{k.shipNext ? `Ngày ${k.shipNext.day}, buổi ${view.slotNames[k.shipNext.slot]}` : k.shipKnown ? 'Chưa rõ' : 'Chưa biết lịch tàu (hãy tìm nơi quan sát cao)'}</dd>
          <dt>🔥 Tín hiệu</dt>
          <dd>
            {view.map.regions.filter((r) => r.structures.some((s) => s.id === 'signal_pyre')).map((r) => r.name).join(', ') || 'Chưa có đống lửa tín hiệu'}
          </dd>
        </dl>
        <p className="tiny faint" style={{ marginTop: 10 }}>
          Cách thoát đảo: đóng bè và ra khơi · phát tín hiệu khi tàu/máy bay đi qua (cần đứng ở nơi nhìn ra biển) · hoặc liều mình ra khơi ngay.
        </p>
      </div>

      <div className="card panel">
        <div className="section-title">📐 Công thức đã biết</div>
        <div className="loc-list">
          {k.recipes.map((r) => (
            <span key={r}>{r}</span>
          ))}
        </div>
      </div>
    </>
  );
}
