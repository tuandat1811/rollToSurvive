import { useState } from 'react';
import type { ActionView, GameView } from '../../../shared/types.ts';
import type { Act } from './Game.tsx';
import { Bar } from './ui.tsx';

export default function TutorialPanel({
  view,
  onPick,
  onHide,
  act,
}: {
  view: GameView;
  onPick: (a: ActionView) => void;
  onHide: () => void;
  act: Act;
}) {
  const [expanded, setExpanded] = useState(false);
  const steps = view.tutorial;
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done);

  if (!current) {
    return (
      <div className="card guide-panel done">
        <div className="row">
          <b>🎉 Bạn đã nắm vững những điều cơ bản!</b>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={onHide}>
            Đóng
          </button>
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Giờ là lúc tự lên kế hoạch: tích trữ nước và thức ăn, học hải lưu, và chọn thời điểm rời đảo.
        </p>
      </div>
    );
  }

  const action = current.action ? view.actions.find((a) => a.key === current.action) : undefined;
  const stepNo = steps.indexOf(current) + 1;

  return (
    <div className="card guide-panel">
      <div className="row">
        <span className="badge dice">🎯 Việc cần làm</span>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Thu gọn' : 'Tất cả bước'}
        </button>
        <button className="btn ghost sm" onClick={onHide} title="Ẩn hướng dẫn (mở lại bằng nút 📖 Hướng dẫn)" aria-label="Ẩn hướng dẫn">
          ✕
        </button>
      </div>
      <div className="tiny faint" style={{ marginTop: 6 }}>
        {current.phase} · Bước {stepNo}/{steps.length}
      </div>
      <h3 className="guide-title">{current.title}</h3>
      <p className="small muted" style={{ margin: '2px 0 8px' }}>
        {current.hint}
      </p>
      <div className="row wrap">
        {action && (
          <button className={`btn sm ${action.available ? 'primary' : ''}`} onClick={() => onPick(action)}>
            {action.icon} {action.name}
          </button>
        )}
        {action && !action.available && <span className="tiny" style={{ color: 'var(--warn)' }}>⛔ {action.reasons[0]}</span>}
        {current.id === 'consume' &&
          view.inventory
            .filter((i) => i.usable && !i.risky)
            .slice(0, 2)
            .map((i) => (
              <button key={i.id} className="btn sm primary" onClick={() => act('consume', { itemId: i.id, from: 'inv' }, { quiet: true })}>
                {i.icon} {i.usable === 'drink' ? 'Uống' : 'Ăn'} {i.name}
              </button>
            ))}
        {current.id === 'night' && <span className="tiny faint">Tiếp tục hành động cho tới hết buổi Tối</span>}
        {current.id === 'lookout' && !action && <span className="tiny faint">Hãy đi tới Núi đá (khám phá để tìm đường)</span>}
        {current.id === 'escape_plan' && !action && <span className="tiny faint">Đến Bãi biển để đóng bè, hoặc nơi nhìn ra biển để dựng đống lửa tín hiệu</span>}
      </div>
      <div style={{ marginTop: 10 }}>
        <Bar value={doneCount} max={steps.length} color="var(--sand)" />
      </div>
      {expanded && (
        <ol className="guide-steps">
          {steps.map((s, k) => (
            <li key={s.id} className={s.done ? 'done' : s === current ? 'now' : ''}>
              {s.done ? '✓' : k + 1 + '.'} {s.title}
              {k === 0 || steps[k - 1].phase !== s.phase ? <span className="tiny faint"> — {s.phase}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
