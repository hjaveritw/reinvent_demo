import { lazy, Suspense } from 'react';
import { AuthGate } from './components/AuthGate';
import { Nav } from './components/Nav';
import { DemoProvider, useDemo } from './state/DemoContext';
import { Presenter } from './views/Presenter';
import { Workbench } from './views/Workbench';
import { Game } from './views/Game';
import { Prd } from './views/Prd';

// Monaco is large; load the diff view only when needed.
const DiffReview = lazy(() => import('./lib/monaco').then(() => import('./views/DiffReview')).then((m) => ({ default: m.DiffReview })));

function Views() {
  const { view } = useDemo();
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 sm:py-10">
      {view === 'presenter' && <Presenter />}
      {view === 'prd' && <Prd />}
      {view === 'workbench' && <Workbench />}
      {view === 'diff' && (
        <Suspense fallback={<div className="py-20 text-center text-fg-muted">Loading diff engine…</div>}>
          <DiffReview />
        </Suspense>
      )}
      {view === 'game' && <Game />}
    </main>
  );
}

export function App() {
  return (
    <AuthGate>
      {(session) => (
        <DemoProvider>
          <Nav username={session.username} signOut={session.signOut} preview={session.preview} />
          <Views />
        </DemoProvider>
      )}
    </AuthGate>
  );
}
