import type { GameView } from '../../../shared/types.ts';

const MOOD: Record<string, { label: string; cls: string }> = {
  good: { label: 'Thuận lợi', cls: 'good' },
  neutral: { label: 'Bình thường', cls: '' },
  bad: { label: 'Bất lợi', cls: 'warn' },
  danger: { label: 'Nguy hiểm', cls: 'bad' },
};

export default function WeatherCard({ view }: { view: GameView }) {
  const w = view.weather;
  const tomorrow = view.forecast[0];
  return (
    <div className={`card weather-card mood-${w.mood}`}>
      <div className="row wrap">
        <span className="weather-icon">{w.icon}</span>
        <div>
          <div className="tiny faint">THỜI TIẾT HÔM NAY</div>
          <b style={{ fontSize: 16 }}>{w.name}</b>
        </div>
        <span className={`badge ${MOOD[w.mood].cls}`}>{MOOD[w.mood].label}</span>
        <div className="spacer" />
        {tomorrow ? (
          <span className="small muted" title={tomorrow.effects.map((e) => (e.good ? '▲ ' : '▼ ') + e.text).join('\n')}>
            Ngày mai: {tomorrow.icon} {tomorrow.name}
          </span>
        ) : (
          <span className="tiny faint" title="Quan sát bầu trời hoặc leo lên đỉnh núi để biết thời tiết ngày mai">
            Ngày mai: chưa rõ
          </span>
        )}
      </div>
      <div className="weather-effects">
        {w.effects.map((e, i) => (
          <span key={i} className={`wfx ${e.good ? 'up' : 'down'}`}>
            {e.good ? '▲' : '▼'} {e.text}
          </span>
        ))}
      </div>
    </div>
  );
}
