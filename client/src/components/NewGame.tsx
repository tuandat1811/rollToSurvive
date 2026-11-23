import { useEffect, useState } from 'react';
import type { GameView, NewGameInfo } from '../../../shared/types.ts';
import { api } from '../api.ts';

const PRESETS: { name: string; icon: string; desc: string; attrs: Record<string, number> }[] = [
  { name: 'Cân bằng', icon: '⚖️', desc: 'Không có điểm yếu rõ rệt.', attrs: { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 } },
  { name: 'Thợ săn', icon: '🏹', desc: 'Nhanh nhẹn, tinh mắt.', attrs: { STR: 2, AGI: 3, END: 1, INT: 1, PER: 3 } },
  { name: 'Kỹ sư', icon: '🔨', desc: 'Giỏi chế tạo, đóng bè.', attrs: { STR: 2, AGI: 1, END: 2, INT: 4, PER: 1 } },
  { name: 'Thủy thủ', icon: '⚓', desc: 'Khỏe mạnh, bền bỉ trên biển.', attrs: { STR: 3, AGI: 1, END: 3, INT: 2, PER: 1 } },
];

export default function NewGame({ onCancel, onCreated }: { onCancel: () => void; onCreated: (v: GameView) => void }) {
  const [info, setInfo] = useState<NewGameInfo | null>(null);
  const [attrs, setAttrs] = useState<Record<string, number>>(PRESETS[0].attrs);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.meta().then(setInfo).catch((e) => setErr(e.message));
  }, []);

  if (!info) return <div className="home">{err ?? 'Đang tải…'}</div>;
  const spent = Object.values(attrs).reduce((a, v) => a + v - info.base, 0);
  const left = info.points - spent;

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const { view } = await api.create(name, attrs);
      onCreated(view);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="newgame">
      <button className="btn ghost sm" onClick={onCancel}>
        ← Quay lại
      </button>
      <h1 style={{ marginTop: 14 }}>Người sống sót</h1>
      <p className="muted">Bạn là ai trước khi con tàu chìm? Phân bổ điểm thuộc tính — chúng sẽ cộng trực tiếp vào mọi lần tung D20.</p>

      <div className="section-title" style={{ marginTop: 20 }}>Tên nhân vật</div>
      <input className="input" placeholder="Người sống sót" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />

      <div className="section-title" style={{ marginTop: 22 }}>Hình mẫu nhanh</div>
      <div className="row wrap">
        {PRESETS.map((p) => (
          <button key={p.name} className="chip" onClick={() => setAttrs(p.attrs)} title={p.desc}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      <div className="row" style={{ marginTop: 22, marginBottom: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>Thuộc tính</div>
        <div className="spacer" />
        <span className={`badge ${left === 0 ? 'good' : 'warn'}`}>Còn {left} điểm</span>
      </div>
      {info.attrs.map((a) => (
        <div key={a.id} className="card attr-row">
          <div>
            <div className="attr-name">
              {a.name} <span className="faint small">({a.id})</span>
            </div>
            <div className="attr-desc">{a.desc}</div>
            <div className="pips">
              {Array.from({ length: info.max }, (_, i) => (
                <i key={i} className={i < attrs[a.id] ? 'on' : ''} />
              ))}
            </div>
          </div>
          <div className="stepper">
            <button aria-label="Giảm" disabled={attrs[a.id] <= info.base} onClick={() => setAttrs({ ...attrs, [a.id]: attrs[a.id] - 1 })}>
              −
            </button>
            <span className="v">{attrs[a.id]}</span>
            <button aria-label="Tăng" disabled={attrs[a.id] >= info.max || left <= 0} onClick={() => setAttrs({ ...attrs, [a.id]: attrs[a.id] + 1 })}>
              +
            </button>
          </div>
        </div>
      ))}

      {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
        <button className="btn primary lg" disabled={left !== 0 || busy} onClick={start}>
          {busy ? 'Đang dạt vào bờ…' : 'Bắt đầu sinh tồn'}
        </button>
      </div>
    </div>
  );
}
