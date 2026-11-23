import type { GameView } from '../../../shared/types.ts';
import { SLOT_ICONS } from './ui.tsx';

export default function TopBar({ view, onExit, onHelp }: { view: GameView; onExit: () => void; onHelp: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">🎲 Roll To Survive</div>
      <div className="daybox">
        <div className="day">Ngày {view.day}</div>
        <div className="slots" aria-label="Buổi trong ngày">
          {view.slotNames.map((n, i) => (
            <span key={n} className={i < view.slot ? 'past' : i === view.slot ? 'now' : ''} title={n}>
              {SLOT_ICONS[i]} <span className="sn">{n}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="weather" title={view.weather.desc}>
        <span className="w-icon">{view.weather.icon}</span>
        <span>{view.weather.name}</span>
        {view.forecast.map((f) => (
          <span key={f.day} className="faint small" title="Dự báo">
            → mai {f.icon} {f.name}
          </span>
        ))}
      </div>
      {view.stormWarning && <span className="storm-warn">⚠️ Bão sắp tới!</span>}
      <div className="mini-vitals" aria-label="Sinh lực">
        {(
          [
            ['❤️', view.vitals.health],
            ['🍖', view.vitals.hunger],
            ['💧', view.vitals.thirst],
            ['⚡', view.vitals.energy],
          ] as [string, number][]
        ).map(([ic, v]) => (
          <span key={ic} className={v <= 10 ? 'crit' : v < 25 ? 'low' : ''}>
            {ic}
            {v}
          </span>
        ))}
      </div>
      <div className="spacer" />
      <div className="row small muted" title={view.location.desc}>
        📍 {view.location.icon} {view.location.name}
        {view.baseRegion === view.location.id && <span className="badge good">⚑ Căn cứ</span>}
      </div>
      <button className="btn ghost sm" onClick={onHelp} title="Xem lại hướng dẫn và bật bảng Việc cần làm">
        📖 Hướng dẫn
      </button>
      <button className="btn ghost sm" onClick={onExit} title="Về trang chủ (ván chơi được tự động lưu)">
        🏠 Thoát
      </button>
    </header>
  );
}
