import { useEffect, useState } from 'react';
import type { GameView } from '../../shared/types.ts';
import { api, rememberRun } from './api.ts';
import Game from './components/Game.tsx';
import Home from './components/Home.tsx';
import NewGame from './components/NewGame.tsx';

type Screen = { name: 'home' } | { name: 'new' } | { name: 'game'; view: GameView };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [loadError, setLoadError] = useState<string | null>(null);

  // deep link: ?run=<id>
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('run');
    if (id) open(id);
  }, []);

  async function open(id: string) {
    setLoadError(null);
    try {
      const { view } = await api.get(id);
      rememberRun(id);
      setScreen({ name: 'game', view });
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }

  if (screen.name === 'new')
    return (
      <NewGame
        onCancel={() => setScreen({ name: 'home' })}
        onCreated={(view) => {
          rememberRun(view.id);
          setScreen({ name: 'game', view });
        }}
      />
    );
  if (screen.name === 'game') return <Game initial={screen.view} onExit={() => setScreen({ name: 'home' })} onNew={() => setScreen({ name: 'new' })} />;
  return <Home onNew={() => setScreen({ name: 'new' })} onOpen={open} error={loadError} />;
}
