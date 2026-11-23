import { useCallback, useEffect, useState } from 'react';
import type { ActionView, GameView, TurnResult } from '../../../shared/types.ts';
import { ApiError, api } from '../api.ts';
import ActionBoard from './ActionBoard.tsx';
import ActionModal from './ActionModal.tsx';
import BasePanel from './BasePanel.tsx';
import CharacterPanel from './CharacterPanel.tsx';
import EndScreen from './EndScreen.tsx';
import EscapeModal from './EscapeModal.tsx';
import EventModal from './EventModal.tsx';
import IntroGuide from './IntroGuide.tsx';
import InventoryPanel from './InventoryPanel.tsx';
import TutorialPanel from './TutorialPanel.tsx';
import JournalPanel from './JournalPanel.tsx';
import MapPanel from './MapPanel.tsx';
import ResultModal from './ResultModal.tsx';
import TopBar from './TopBar.tsx';
import Vitals from './Vitals.tsx';

type SideTab = 'map' | 'inv' | 'base' | 'journal';
type MobileTab = 'actions' | 'status' | 'map' | 'inv' | 'journal';

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export type Act =(path: string, body: Record<string, unknown>, opts?: { quiet?: boolean }) => Promise<boolean>;

export default function Game({ initial, onExit, onNew }: { initial: GameView; onExit: () => void; onNew: () => void }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: 'err' | 'ok' } | null>(null);
  const [result, setResult] = useState<TurnResult | null>(() => (initial.day === 1 && initial.slot === 0 && initial.version === 0 ? initial.last : null));
  const [selected, setSelected] = useState<ActionView | null>(null);
  const [side, setSide] = useState<SideTab>('map');
  const [mobile, setMobile] = useState<MobileTab>('actions');
  const [showEnd, setShowEnd] = useState(true);
  const isFresh = initial.day === 1 && initial.slot === 0 && initial.version === 0;
  const [introOpen, setIntroOpen] = useState(() => isFresh && !readPref('rts.introSeen'));
  const [tutorialHidden, setTutorialHidden] = useState(() => !!readPref(`rts.tutorialHidden.${initial.id}`));

  const closeIntro = () => {
    writePref('rts.introSeen', '1');
    setIntroOpen(false);
  };
  const setHidden = (hidden: boolean) => {
    writePref(`rts.tutorialHidden.${view.id}`, hidden ? '1' : null);
    setTutorialHidden(hidden);
  };
  const guideKey = tutorialHidden ? undefined : view.tutorial.find((t) => !t.done)?.action;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // keep the URL shareable / reload-safe
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('run', view.id);
    history.replaceState(null, '', url);
    return () => {
      const u = new URL(location.href);
      u.searchParams.delete('run');
      history.replaceState(null, '', u);
    };
  }, [view.id]);

  const act: Act = useCallback(
    async (path, body, opts) => {
      if (busy) return false;
      setBusy(true);
      try {
        const { view: v } = await api.act(view.id, path, { ...body, version: view.version });
        setView(v);
        if (opts?.quiet) {
          const txt = v.last?.changes.map((c) => c.text).join(' · ');
          if (txt) setToast({ text: txt, kind: 'ok' });
          if (v.last && (v.last.narrative.length || v.last.notices.length)) setResult(v.last);
        } else if (v.last) setResult(v.last);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.view) setView(e.view);
        setToast({ text: (e as Error).message, kind: 'err' });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, view.id, view.version],
  );

  const ended = view.status !== 'playing';
  const pickSide = (t: SideTab) => {
    setSide(t);
    setMobile(t === 'base' ? 'inv' : (t as MobileTab));
  };

  return (
    <div className="game">
      <TopBar
        view={view}
        onExit={onExit}
        onHelp={() => {
          setHidden(false);
          setIntroOpen(true);
        }}
      />
      <div className="layout">
        <div className="col" data-hidden={mobile !== 'status'}>
          <Vitals view={view} act={act} guideConsume={!tutorialHidden && view.tutorial.find((t) => !t.done)?.id === 'consume'} />
          <CharacterPanel view={view} act={act} />
        </div>
        <div className="col" data-hidden={mobile !== 'actions'}>
          {!tutorialHidden && view.status === 'playing' && <TutorialPanel view={view} onPick={setSelected} onHide={() => setHidden(true)} act={act} />}
          <ActionBoard view={view} onPick={setSelected} guideKey={guideKey} />
        </div>
        <div className="col" data-hidden={mobile === 'actions' || mobile === 'status'}>
          <div className="tabs">
            {(
              [
                ['map', '🗺️ Bản đồ'],
                ['inv', '🎒 Hành trang'],
                ['base', '⛺ Căn cứ'],
                ['journal', '📓 Nhật ký'],
              ] as [SideTab, string][]
            ).map(([k, label]) => (
              <button key={k} className={side === k ? 'on' : ''} onClick={() => pickSide(k)}>
                {label}
              </button>
            ))}
          </div>
          {side === 'map' && (
            <MapPanel
              view={view}
              onTravel={(key) => {
                const a = view.actions.find((x) => x.key === key);
                if (a) setSelected(a);
              }}
            />
          )}
          {side === 'inv' && <InventoryPanel view={view} act={act} />}
          {side === 'base' && <BasePanel view={view} />}
          {side === 'journal' && <JournalPanel view={view} />}
        </div>
      </div>

      <nav className="mobile-nav">
        {(
          [
            ['actions', '🎲', 'Hành động'],
            ['status', '❤️', 'Trạng thái'],
            ['map', '🗺️', 'Bản đồ'],
            ['inv', '🎒', 'Hành trang'],
            ['journal', '📓', 'Nhật ký'],
          ] as [MobileTab, string, string][]
        ).map(([k, ic, label]) => (
          <button
            key={k}
            className={mobile === k ? 'on' : ''}
            onClick={() => {
              setMobile(k);
              if (k === 'map' || k === 'inv' || k === 'journal') setSide(k);
            }}
          >
            <span>{ic}</span>
            {label}
          </button>
        ))}
      </nav>

      {selected && !result && (
        <ActionModal
          action={view.actions.find((a) => a.key === selected.key) ?? selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onConfirm={async () => {
            const ok = await act('action', { key: selected.key });
            if (ok) setSelected(null);
          }}
        />
      )}
      {introOpen && <IntroGuide onClose={closeIntro} />}
      {!introOpen && result && <ResultModal result={result} onClose={() => setResult(null)} />}
      {!introOpen && !result && !ended && view.escape && <EscapeModal view={view} busy={busy} act={act} />}
      {!introOpen && !result && !ended && !view.escape && view.pending && <EventModal event={view.pending} busy={busy} act={act} />}
      {!result && ended && showEnd && <EndScreen view={view} onExit={onExit} onNew={onNew} onClose={() => setShowEnd(false)} />}
      {toast && (
        <div className="toast" style={toast.kind === 'ok' ? { background: '#16342b', borderColor: 'var(--good)', color: '#d9f5cf' } : undefined}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
