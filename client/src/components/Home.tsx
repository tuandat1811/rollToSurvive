import { useEffect, useState } from 'react';
import type { RunSummary } from '../../../shared/types.ts';
import { api, forgetRun, savedRuns } from '../api.ts';

const SLOT = ['Sáng', 'Trưa', 'Chiều', 'Tối'];

export default function Home({ onNew, onOpen, error }: { onNew: () => void; onOpen: (id: string) => void; error: string | null }) {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);

  useEffect(() => {
    const ids = savedRuns();
    if (!ids.length) return setRuns([]);
    api
      .list(ids)
      .then((r) => setRuns(r.runs))
      .catch(() => setRuns([]));
  }, []);

  async function remove(id: string) {
    if (!confirm('Xóa vĩnh viễn ván chơi này? Không thể hoàn tác.')) return;
    await api.remove(id).catch(() => undefined);
    forgetRun(id);
    setRuns((r) => r?.filter((x) => x.id !== id) ?? null);
  }

  const playing = runs?.filter((r) => r.status === 'playing') ?? [];
  const finished = runs?.filter((r) => r.status !== 'playing') ?? [];

  return (
    <div className="home">
      <div className="home-inner">
        <div className="island-art">🏝️🎲</div>
        <div className="logo">
          Roll To Survive
          <small>Sinh tồn theo lượt · Xúc xắc D20</small>
        </div>
        <p className="tagline">
          Mắc kẹt trên hòn đảo hoang. Mỗi quyết định là một canh bạc. Sống sót đủ lâu để mạnh lên — hoặc liều mình thoát đảo ngay hôm nay.
        </p>
        <button className="btn primary lg" onClick={onNew}>
          Bắt đầu ván mới
        </button>
        {error && <p style={{ color: 'var(--bad)', marginTop: 14 }}>{error}</p>}

        {runs && runs.length > 0 && (
          <div className="saves">
            {playing.length > 0 && <div className="section-title">Tiếp tục</div>}
            {playing.map((r) => (
              <div key={r.id} className="card save-row">
                <div style={{ fontSize: 26 }}>🧍</div>
                <div>
                  <div className="name">{r.name}</div>
                  <div className="small muted">
                    Ngày {r.day} · {SLOT[r.slot]} · {new Date(r.updatedAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="spacer" />
                <button className="btn ghost sm" onClick={() => remove(r.id)} title="Xóa ván">
                  🗑️
                </button>
                <button className="btn primary" onClick={() => onOpen(r.id)}>
                  Chơi tiếp
                </button>
              </div>
            ))}
            {finished.length > 0 && <div className="section-title" style={{ marginTop: 18 }}>Đã kết thúc</div>}
            {finished.map((r) => (
              <div key={r.id} className="card save-row" style={{ opacity: 0.8 }}>
                <div style={{ fontSize: 24 }}>{r.status === 'victory' ? '🏆' : '🪦'}</div>
                <div>
                  <div className="name">{r.name}</div>
                  <div className="small muted">
                    {r.status === 'victory' ? 'Thoát đảo' : 'Tử nạn'} · Ngày {r.day}
                  </div>
                </div>
                <div className="spacer" />
                <button className="btn ghost sm" onClick={() => remove(r.id)} title="Xóa">
                  🗑️
                </button>
                <button className="btn sm" onClick={() => onOpen(r.id)}>
                  Xem lại
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pillars">
          <div className="card"><b>🎲 Mọi hành động là canh bạc</b>D20 + chỉ số + kỹ năng + trang bị.</div>
          <div className="card"><b>🌱 Sống sót để mạnh lên</b>Kỹ năng tăng khi dùng, chỉ số tăng theo số ngày sống sót.</div>
          <div className="card"><b>⛵ Thoát đảo bất cứ lúc nào</b>Ngay từ Ngày 1 — nếu bạn dám.</div>
          <div className="card"><b>💀 Chết là hết</b>Sức khỏe về 0, hành trình kết thúc.</div>
        </div>
      </div>
    </div>
  );
}
