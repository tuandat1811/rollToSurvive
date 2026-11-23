import { useState } from 'react';
import type { GameView } from '../../../shared/types.ts';

const ICON: Record<string, string> = { discovery: '🔎', event: '📜', milestone: '⭐', consequence: '⚠️', info: '•', escape: '⛵' };
const FILTERS: [string, string][] = [
  ['all', 'Tất cả'],
  ['discovery', 'Khám phá'],
  ['consequence', 'Hậu quả'],
  ['milestone', 'Cột mốc'],
  ['escape', 'Thoát đảo'],
];

export default function JournalPanel({ view }: { view: GameView }) {
  const [f, setF] = useState('all');
  const list = view.journal.filter((j) => f === 'all' || j.kind === f);
  return (
    <div className="card panel">
      <div className="chips">
        {FILTERS.map(([k, n]) => (
          <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>
            {n}
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="empty">Chưa có ghi chép.</div>}
      {list.map((j, i) => (
        <div key={i} className="journal-entry">
          <span>{ICON[j.kind] ?? '•'}</span>
          <div>
            <div className="when">
              Ngày {j.day} · {view.slotNames[j.slot]}
            </div>
            {j.text}
          </div>
        </div>
      ))}
    </div>
  );
}
