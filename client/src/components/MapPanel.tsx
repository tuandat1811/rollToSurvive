import { useState } from 'react';
import type { GameView } from '../../../shared/types.ts';
import { Bar } from './ui.tsx';

const ISLAND =
  'M 150 430 C 110 340 160 240 250 205 C 320 140 410 100 510 112 C 590 86 690 62 790 78 C 870 92 900 160 852 205 C 812 240 770 248 752 292 C 772 362 768 446 726 506 C 684 586 604 646 484 648 C 382 652 290 616 228 566 C 176 524 172 480 150 430 Z';

export default function MapPanel({ view, onTravel }: { view: GameView; onTravel: (key: string) => void }) {
  const [sel, setSel] = useState<string>(view.location.id);
  const regions = view.map.regions;
  const pos = Object.fromEntries(regions.map((r) => [r.id, r]));
  const r = regions.find((x) => x.id === sel) ?? regions.find((x) => x.here)!;
  const travel = view.actions.find((a) => a.key === `travel:${r.id}`);
  const route = view.map.routes.find((x) => (x.a === r.id && x.b === view.location.id) || (x.b === r.id && x.a === view.location.id));

  return (
    <div className="card panel">
      {view.traits.length > 0 && (
        <div className="island-traits">
          <div className="section-title">🎲 Hòn đảo lần này</div>
          {view.traits.map((t) => (
            <div key={t.id} className={`trait trait-${t.mood}`}>
              <b>
                {t.icon} {t.name}
              </b>
              <span>{t.desc}</span>
            </div>
          ))}
        </div>
      )}
      <div className="map-wrap">
        <svg viewBox="0 0 960 720" role="img" aria-label="Bản đồ hòn đảo">
          <defs>
            <radialGradient id="sand" cx="50%" cy="50%" r="60%">
              <stop offset="0" stopColor="#5c7a3c" />
              <stop offset="0.72" stopColor="#4a6a35" />
              <stop offset="0.9" stopColor="#b9a26a" />
              <stop offset="1" stopColor="#d8c48a" />
            </radialGradient>
          </defs>
          {/* waves */}
          {[0, 1, 2].map((i) => (
            <path key={i} d={ISLAND} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={30 + i * 26} />
          ))}
          <path d={ISLAND} fill="url(#sand)" stroke="#e7d7a4" strokeWidth="3" />
          {/* river decoration */}
          {pos.river.discovery === 'discovered' && (
            <path d="M 470 200 C 560 260 640 300 640 390 C 640 470 560 540 520 640" fill="none" stroke="#5fb4d9" strokeWidth="7" strokeLinecap="round" opacity="0.7" />
          )}
          {/* routes */}
          {view.map.routes.map((rt) => {
            const a = pos[rt.a];
            const b = pos[rt.b];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const color = rt.status === 'blocked' ? '#ef6b5b' : rt.danger ? '#f4a261' : '#f4ead0';
            return (
              <g key={rt.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color}
                  strokeWidth="4"
                  strokeDasharray={rt.status === 'blocked' ? '10 8' : rt.danger || rt.detour ? '4 8' : '14 6'}
                  opacity="0.85"
                />
                {rt.status === 'blocked' && (
                  <text x={mx} y={my + 9} textAnchor="middle" fontSize="26">
                    🌳
                  </text>
                )}
              </g>
            );
          })}
          {/* nodes */}
          {regions
            .filter((x) => x.discovery !== 'unknown')
            .map((x) => (
              <g key={x.id} className="map-node" onClick={() => setSel(x.id)} opacity={x.discovery === 'clued' ? 0.55 : 1}>
                {x.here && (
                  <circle cx={x.x} cy={x.y} r="46" fill="none" stroke="#e9c46a" strokeWidth="3">
                    <animate attributeName="r" values="42;52;42" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  className="ring"
                  cx={x.x}
                  cy={x.y}
                  r="38"
                  fill={x.id === sel ? '#224a4e' : '#142f33'}
                  stroke={x.here ? '#e9c46a' : '#f1ead8'}
                  strokeWidth={x.id === sel ? 4 : 2}
                />
                <text x={x.x} y={x.y + 13} textAnchor="middle" fontSize="36">
                  {x.discovery === 'clued' ? '❔' : x.icon}
                </text>
                <text x={x.x} y={x.y + 70} textAnchor="middle" fontSize="28" fontWeight="700" fill="#fff" stroke="#0c1c1f" strokeWidth="5" paintOrder="stroke">
                  {x.discovery === 'clued' ? `${x.name}?` : x.name}
                </text>
                {x.base && (
                  <text x={x.x + 30} y={x.y - 24} fontSize="26">
                    ⚑
                  </text>
                )}
                {x.unexplored > 0 && x.discovery === 'discovered' && (
                  <circle cx={x.x - 30} cy={x.y - 28} r="9" fill="#f4a261" stroke="#0c1c1f" strokeWidth="3" />
                )}
              </g>
            ))}
        </svg>
      </div>
      <div className="map-legend">
        <span>━ Đường thông</span>
        <span style={{ color: 'var(--warn)' }}>┅ Đường nguy hiểm</span>
        <span style={{ color: 'var(--bad)' }}>┅ Bị chặn</span>
        <span>🟠 Còn điều chưa khám phá</span>
        <span>⚑ Căn cứ</span>
      </div>

      <div className="card region-info" style={{ background: 'var(--bg-2)' }}>
        <div className="row">
          <h3 style={{ fontSize: 17 }}>
            {r.discovery === 'clued' ? '❔' : r.icon} {r.name}
          </h3>
          <div className="spacer" />
          {r.here && <span className="badge good">📍 Bạn ở đây</span>}
          {r.surveyed && <span className="badge">Đã khảo sát</span>}
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {r.desc}
        </p>
        {r.locations.length > 0 && (
          <div className="loc-list">
            {r.locations.map((l) => (
              <span key={l.id} title={l.desc}>
                {l.icon} {l.name}
              </span>
            ))}
          </div>
        )}
        {r.structures.length > 0 && (
          <div className="loc-list">
            {r.structures.map((s, i) => (
              <span key={i} title={`Độ bền ${s.integrity}%`}>
                {s.icon} {s.name} {s.integrity < 100 ? `(${s.integrity}%)` : ''}
              </span>
            ))}
          </div>
        )}
        {r.abundance && (
          <div className="abund">
            {r.abundance.forage > 0 && (
              <>
                <span>🍌 Thức ăn</span>
                <Bar value={r.abundance.forage} max={110} color="var(--hunger)" />
              </>
            )}
            {r.abundance.fish > 0 && (r.id === 'coast' || r.id === 'river' || r.id === 'cape') && (
              <>
                <span>🐟 Cá</span>
                <Bar value={r.abundance.fish} max={110} color="var(--thirst)" />
              </>
            )}
            {r.abundance.game > 0 && r.id === 'jungle' && (
              <>
                <span>🐗 Thú</span>
                <Bar value={r.abundance.game} max={110} color="var(--coral)" />
              </>
            )}
            {(r.id === 'jungle' || r.id === 'coast') && (
              <>
                <span>🪵 Gỗ</span>
                <Bar value={r.abundance.wood} max={120} color="var(--sand)" />
              </>
            )}
          </div>
        )}
        {r.water && <div className="small" style={{ marginTop: 6 }}>💧 Nước suối: {r.water}</div>}
        {!r.here && (
          <div className="row" style={{ marginTop: 10 }}>
            {route ? (
              <button className="btn primary sm" disabled={!travel} onClick={() => travel && onTravel(travel.key)}>
                Đi tới đây ({route.status === 'blocked' ? 'bị chặn' : `⚡${travel?.energy ?? route.energy}`})
              </button>
            ) : (
              <span className="small faint">Không có đường đi trực tiếp từ vị trí hiện tại.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
