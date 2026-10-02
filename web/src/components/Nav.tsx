import { Gamepad2, GitCompareArrows, LogOut, MonitorPlay, ScrollText, Workflow } from 'lucide-react';
import { useDemo } from '../state/DemoContext';
import { mmss } from '../lib/format';
import type { ViewId } from '../lib/stages';
import { cx } from './ui';

const ITEMS: { id: ViewId; label: string; icon: typeof MonitorPlay }[] = [
  { id: 'presenter', label: 'Presenter', icon: MonitorPlay },
  { id: 'prd', label: 'PRD', icon: ScrollText },
  { id: 'workbench', label: 'Workbench', icon: Workflow },
  { id: 'diff', label: 'Review & Diff', icon: GitCompareArrows },
  { id: 'game', label: 'Live Game', icon: Gamepad2 },
];

export function Nav({ username, signOut, preview }: { username: string; signOut: () => void; preview: boolean }) {
  const { view, go, clock } = useDemo();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => go('presenter')} className="flex shrink-0 items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="7" fill="#0b1224" stroke="#2a3655" /><path d="M8 21l6-10 4 6 2-3 4 7z" fill="#f5c518" /></svg>
          <span className="hidden text-[15px] font-bold tracking-tight md:inline">Modernization Studio</span>
        </button>
        <nav className="scroll-thin -mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
          {ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={cx(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                view === id ? 'bg-ink-800 text-amber' : 'text-fg-muted hover:text-fg',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
        {clock.elapsed > 0 && view !== 'presenter' && (
          <button type="button" onClick={() => go('presenter')} className={cx('hidden rounded-lg border px-2.5 py-1 font-mono text-sm sm:block', clock.remaining < 0 ? 'border-bad/40 text-bad' : 'border-amber/40 text-amber')}>
            {clock.remaining < 0 ? '+' : ''}{mmss(Math.abs(clock.remaining))}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {preview && <span className="hidden rounded-md border border-warn/40 px-2 py-0.5 font-mono text-[11px] text-warn lg:inline">LOCAL PREVIEW</span>}
          <span className="hidden max-w-[180px] truncate text-xs text-fg-dim lg:inline">{username}</span>
          {!preview && (
            <button type="button" onClick={signOut} className="rounded-lg p-2 text-fg-muted hover:text-fg" title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
