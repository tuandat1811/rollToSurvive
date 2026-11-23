import { useEffect, useState } from 'react';
import type { TurnResult } from '../../../shared/types.ts';
import { Changes, D20, Formula, Modal, NoticeCard, ThresholdTable, TIER_NAMES, diceText } from './ui.tsx';

const ATTR_NAMES: Record<string, string> = { STR: 'Sức mạnh', AGI: 'Nhanh nhẹn', END: 'Sức bền', INT: 'Trí tuệ', PER: 'Quan sát' };
const SKILL_NAMES: Record<string, string> = {
  survival: 'Sinh tồn',
  hunting: 'Săn bắt',
  fishing: 'Đánh cá',
  crafting: 'Chế tạo',
  medicine: 'Y thuật',
  navigation: 'Định hướng',
};

export default function ResultModal({ result, onClose }: { result: TurnResult; onClose: () => void }) {
  const roll = result.roll;
  const [phase, setPhase] = useState<'rolling' | 'done'>(roll ? 'rolling' : 'done');
  const [face, setFace] = useState<number[]>(roll ? roll.dice.map(() => 1) : []);

  useEffect(() => {
    if (!roll) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setPhase('done');
      return;
    }
    const iv = setInterval(() => setFace(roll.dice.map(() => 1 + Math.floor(Math.random() * 20))), 70);
    const t = setTimeout(() => {
      clearInterval(iv);
      setPhase('done');
    }, 900);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [roll]);

  const done = phase === 'done';
  const close = () => (done ? onClose() : setPhase('done'));

  return (
    <Modal onClose={close} wide>
      <div className="modal-head">
        <span className="big">{result.icon}</span>
        <div>
          <h2>{result.title}</h2>
          {result.timeAdvanced > 0 && done && <div className="small faint">⏱ Thời gian trôi qua: {result.timeAdvanced} buổi</div>}
        </div>
      </div>
      <div className="modal-body">
        {roll && (
          <div className="box" onClick={() => !done && setPhase('done')} style={{ cursor: done ? 'default' : 'pointer' }}>
            <div className="dice-stage">
              {roll.dice.map((d, i) => {
                const chosen = d === roll.natural && roll.dice.indexOf(d) === i;
                return (
                  <D20
                    key={i}
                    value={done ? d : face[i]}
                    state={!done ? 'rolling' : roll.dice.length > 1 && !chosen ? 'dim' : 'landed'}
                    nat={done && d === 20}
                  />
                );
              })}
            </div>
            <div className="tiny faint" style={{ textAlign: 'center' }}>
              Tung {diceText(roll.dice.length, roll.adv)}
            </div>
            {done && (
              <>
                <div style={{ marginTop: 10 }}>
                  <Formula
                    check={{ ...roll, attrName: ATTR_NAMES[roll.attr], skillName: roll.skill ? SKILL_NAMES[roll.skill] : undefined }}
                    natural={roll.natural}
                  />
                </div>
                <div className="row" style={{ justifyContent: 'center', marginTop: 8, fontSize: 15 }}>
                  Tổng <b style={{ fontSize: 22, fontFamily: 'var(--serif)' }}>{roll.total}</b> so với DC <b>{roll.dc}</b>
                  {roll.natural === 20 && <span className="badge dice">Natural 20!</span>}
                  {roll.natural === 1 && <span className="badge bad">Natural 1!</span>}
                </div>
                <div className={`tier-banner t-${roll.tier}`}>{TIER_NAMES[roll.tier]}</div>
                {roll.bands && (
                  <div style={{ marginTop: 10 }}>
                    <ThresholdTable bands={roll.bands} crit={roll.crit} highlight={roll.tier} compact />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {done && (
          <>
            {result.narrative.map((p, i) => (
              <p key={i} className="narr">
                {p}
              </p>
            ))}
            <Changes changes={result.changes} />
            {result.notices.map((n, i) => (
              <NoticeCard key={i} n={n} />
            ))}
          </>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={close} autoFocus>
          {done ? 'Tiếp tục' : 'Bỏ qua hiệu ứng'}
        </button>
      </div>
    </Modal>
  );
}
