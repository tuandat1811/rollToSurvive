import { useEffect, type ReactNode } from 'react';
import type { Band, Change, CheckView, CritPolicy, Notice, Tier } from '../../../shared/types.ts';

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

export const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** short "what do I need to roll" label for cards and badges */
export function needLabel(c: CheckView): string {
  if (c.opposed) return `Đấu ${c.opposed.icon ?? ''} ${c.opposed.label}`;
  if (c.successFace === null) return 'Không thể thành công';
  if (c.successFace <= 1) return 'Chắc chắn thành công';
  return `${c.dice === 2 ? '2d20' : 'd20'} ≥ ${c.successFace}`;
}

export function diceText(dice: number, adv: number): string {
  if (dice <= 1) return '1 viên d20';
  return adv > 0 ? '2 viên d20, lấy viên CAO hơn (lợi thế)' : '2 viên d20, lấy viên THẤP hơn (bất lợi)';
}

function critNote(crit: CritPolicy | undefined): string {
  if (crit === 'none') return 'Không áp dụng quy tắc tung ra 20/1.';
  if (crit === 'safe') return 'Việc an toàn: không có Thất bại thảm hại. Tung ra 20 thì kết quả tăng 1 bậc.';
  return 'Tung ra 20: kết quả tăng 1 bậc. Tung ra 1: kết quả giảm 1 bậc.';
}

const range = (a: number, b: number) => (a === b ? `${a}` : `${a} – ${b}`);

/** score thresholds per outcome tier: total needed and die face needed */
export function ThresholdTable({ bands, crit, highlight, compact }: { bands: Band[]; crit?: CritPolicy; highlight?: Tier; compact?: boolean }) {
  return (
    <div className={`thresholds ${compact ? 'compact' : ''}`}>
      <table>
        <thead>
          <tr>
            <th>Kết quả</th>
            <th>Tổng điểm</th>
            <th>Mặt xúc xắc cần ra</th>
          </tr>
        </thead>
        <tbody>
          {TIER_ORDER.map((t) => {
            const b = bands.find((x) => x.tier === t);
            const top = b && b.faceMax === 20;
            const bottom = b && b.faceMin === 1;
            return (
              <tr key={t} className={`${b ? '' : 'impossible'} ${highlight === t ? 'hit' : ''}`}>
                <td>
                  <i className={`dot t-${t}`} />
                  {TIER_NAMES[t]}
                </td>
                <td>{!b ? '—' : top && b.faceMin < 20 ? `${b.totalMin} trở lên` : bottom && b.faceMax > 1 ? `${b.totalMax} trở xuống` : range(b.totalMin, b.totalMax)}</td>
                <td>{!b ? 'Không thể xảy ra' : range(b.faceMin, b.faceMax)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="tiny faint">{critNote(crit)}</div>
    </div>
  );
}

export function Formula({ check, natural, vs }: { check: { attr: string; attrName?: string; attrMod: number; skillName?: string; skill?: string; skillMod: number; mods: { label: string; value: number }[]; dc: number; adv: number }; natural?: number; vs?: string }) {
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
      <span className="term dc">{vs ?? `DC ${check.dc}`}</span>
    </div>
  );
}

/** opposed check: outcome depends on how far you beat (or trail) the opponent's total */
export function OpposedTable({ check }: { check: CheckView }) {
  const o = check.opposed!;
  const rows: [Tier, string][] = [
    ['crit_success', 'Hơn đối thủ từ 10 điểm trở lên'],
    ['success', 'Bằng hoặc hơn đối thủ (0 – 9 điểm)'],
    ['partial', 'Kém đối thủ 1 – 4 điểm'],
    ['failure', 'Kém đối thủ 5 – 9 điểm'],
    ['crit_failure', 'Kém đối thủ từ 10 điểm trở lên'],
  ];
  const typical = 11 + o.bonus;
  const need = typical - check.totalMod;
  return (
    <div className="thresholds">
      <table>
        <thead>
          <tr>
            <th>Kết quả</th>
            <th>Tổng của bạn so với đối thủ</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter(([t]) => check.crit !== 'safe' || t !== 'crit_failure').map(([t, txt]) => (
            <tr key={t}>
              <td>
                <i className={`dot t-${t}`} />
                {TIER_NAMES[t]}
              </td>
              <td>{txt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tiny faint">
        Đối thủ tung trung bình ra 10–11 → tổng khoảng {typical}. Muốn thắng một lần tung trung bình, bạn cần mặt xúc xắc ≥ {Math.max(1, Math.min(20, need))}. {critNote(check.crit)}
      </div>
    </div>
  );
}

/** modifier terms only, with their sum */
export function ModList({ check }: { check: CheckView }) {
  return (
    <div className="formula">
      <span className="term">
        {sign(check.attrMod)} {check.attrName}
      </span>
      {check.skill && (
        <span className="term">
          {sign(check.skillMod)} {check.skillName}
        </span>
      )}
      {check.mods.map((m, i) => (
        <span key={i} className={`term ${m.value < 0 ? 'neg' : 'pos'}`}>
          {sign(m.value)} {m.label}
        </span>
      ))}
      <span className="faint">=</span>
      <span className="term dc">{sign(check.totalMod)}</span>
    </div>
  );
}

export function CheckBox({ check, compact }: { check: CheckView; compact?: boolean }) {
  return (
    <div className={compact ? 'check-compact' : 'box'}>
      {!compact && (
        <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <b>🎲 {check.label || 'Kiểm tra D20'}</b>
          {check.opposed ? (
            <span className="badge warn">
              ⚔️ Đối kháng: {check.opposed.icon} {check.opposed.label}
            </span>
          ) : (
            <span className="badge dice">
              Độ khó: {check.dcLabel} · DC {check.dc}
            </span>
          )}
        </div>
      )}
      <dl className="check-lines">
        <dt>Tung</dt>
        <dd>
          <b>{diceText(check.dice, check.adv)}</b>
          {check.prepared && <div className="small" style={{ color: 'var(--good)' }}>⭐ {check.prepared} — được lợi thế</div>}
        </dd>
        <dt>Cộng điểm</dt>
        <dd>
          <ModList check={check} />
        </dd>
        <dt>Tổng điểm</dt>
        <dd>
          {check.opposed ? (
            <>
              Mặt xúc xắc <b>{sign(check.totalMod)}</b>, so với <b>{check.opposed.icon} {check.opposed.label}: d20 {sign(check.opposed.bonus)}</b>
            </>
          ) : (
            <>
              Mặt xúc xắc <b>{sign(check.totalMod)}</b>, so với <b>DC {check.dc}</b>
            </>
          )}
        </dd>
      </dl>
      {check.opposed ? <OpposedTable check={check} /> : <ThresholdTable bands={check.bands} crit={check.crit} compact={compact} />}
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
