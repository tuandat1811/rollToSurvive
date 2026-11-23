import { useEffect, type ReactNode } from 'react';
import type { Change, CheckView, Notice, Tier } from '../../../shared/types.ts';

export const TIER_NAMES: Record<Tier, string> = {
  crit_success: 'Thành công vang dội',
  success: 'Thành công',
  partial: 'Thành công một phần',
  failure: 'Thất bại',
  crit_failure: 'Thất bại thảm hại',
};
const TIER_ORDER: Tier[] = ['crit_success', 'success', 'partial', 'failure', 'crit_failure'];

export function Modal({
  children,
  onClose,
  wide,
  className,
}: {
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="bar">
      <span style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function successChance(c: CheckView) {
  return c.odds.success + c.odds.crit_success;
}

export function OddsBar({ check }: { check: CheckView }) {
  return (
    <>
      <div className="odds" aria-label="Xác suất kết quả">
        {TIER_ORDER.map((t) => (check.odds[t] > 0 ? <span key={t} className={`t-${t}`} style={{ width: pct(check.odds[t]) }} title={`${TIER_NAMES[t]}: ${pct(check.odds[t])}`} /> : null))}
      </div>
      <div className="odds-legend">
        {TIER_ORDER.map((t) =>
          check.odds[t] >= 0.005 ? (
            <span key={t}>
              <i className={`t-${t}`} />
              {TIER_NAMES[t]} {pct(check.odds[t])}
            </span>
          ) : null,
        )}
      </div>
    </>
  );
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function Formula({ check, natural }: { check: { attr: string; attrName?: string; attrMod: number; skillName?: string; skill?: string; skillMod: number; mods: { label: string; value: number }[]; dc: number; adv: number }; natural?: number }) {
  return (
    <div className="formula">
      <span className="term die">{natural ?? 'd20'}{check.adv > 0 ? ' (lợi thế)' : check.adv < 0 ? ' (bất lợi)' : ''}</span>
      <span className="term">
        {sign(check.attrMod)} {check.attrName ?? check.attr}
      </span>
      {check.skill && (
        <span className="term">
          {sign(check.skillMod)} {check.skillName ?? check.skill}
        </span>
      )}
      {check.mods.map((m, i) => (
        <span key={i} className={`term ${m.value < 0 ? 'neg' : 'pos'}`}>
          {sign(m.value)} {m.label}
        </span>
      ))}
      <span className="faint">so với</span>
      <span className="term dc">DC {check.dc}</span>
    </div>
  );
}

export function CheckBox({ check }: { check: CheckView }) {
  return (
    <div className="box">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <b>🎲 {check.label || 'Kiểm tra D20'}</b>
        <span className="badge dice">
          Độ khó: {check.dcLabel} · Thành công {pct(successChance(check))}
        </span>
      </div>
      <Formula check={check} />
      <OddsBar check={check} />
    </div>
  );
}

export function Changes({ changes }: { changes: Change[] }) {
  if (!changes.length) return null;
  return (
    <div className="changes">
      {changes.map((c, i) => (
        <div key={i} className={`change ${c.kind}`}>
          {c.text}
        </div>
      ))}
    </div>
  );
}

export function NoticeCard({ n }: { n: Notice }) {
  return (
    <div className="notice">
      <h3>
        <span>{n.icon}</span> {n.title}
      </h3>
      {n.text && <p>{n.text}</p>}
      <Changes changes={n.changes} />
    </div>
  );
}

export function D20({ value, state, nat }: { value: number | string; state: 'rolling' | 'landed' | 'dim'; nat?: boolean }) {
  return (
    <div className={`d20 ${state} ${nat ? 'nat20' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="dg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6dc8e" />
            <stop offset="1" stopColor="#d9a63c" />
          </linearGradient>
        </defs>
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="url(#dg)" stroke="#7a5a19" strokeWidth="2.5" />
        <polygon points="50,22 76,66 24,66" fill="none" stroke="#9c7522" strokeWidth="1.6" opacity="0.7" />
        <path d="M50 3 L50 22 M93 27 L76 66 M7 27 L24 66 M50 97 L76 66 M50 97 L24 66 M93 73 L76 66 M7 73 L24 66 M93 27 L50 22 M7 27 L50 22" stroke="#9c7522" strokeWidth="1.2" opacity="0.55" />
      </svg>
      <span className="n">{value}</span>
    </div>
  );
}

export const SLOT_ICONS = ['🌅', '☀️', '🌇', '🌙'];
