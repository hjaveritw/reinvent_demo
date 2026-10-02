import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { STAGES, TARGET_SECONDS, stageAt, type ViewId, type WorkbenchTab } from '../lib/stages';
import type { Job } from '../lib/types';

const TERMINAL = new Set(['VERIFIED', 'FAILED']);

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
};

interface DemoState {
  view: ViewId;
  tab: WorkbenchTab;
  go: (view: ViewId, tab?: WorkbenchTab) => void;
  jobId: string | null;
  setJobId: (id: string | null) => void;
  job: Job | null;
  jobError: string | null;
  refreshJob: () => Promise<void>;
  clock: { running: boolean; elapsed: number; remaining: number; toggle: () => void; reset: () => void };
  stageIndex: number;
  setStageIndex: (i: number) => void;
}

const Ctx = createContext<DemoState | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>(() => {
    const h = window.location.hash.slice(1);
    return (['presenter', 'prd', 'workbench', 'diff', 'game'] as const).find((v) => v === h) ?? 'presenter';
  });
  const [tab, setTab] = useState<WorkbenchTab>('scan');
  const [jobId, setJobIdState] = useState<string | null>(() => store.get('ats.jobId'));
  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // ---- presenter clock (persists across views)
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stageIndex, setStageIndexState] = useState(0);
  const manualStage = useRef(false);
  const startedAt = useRef<number | null>(null);
  const base = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const e = base.current + (Date.now() - (startedAt.current ?? Date.now())) / 1000;
      setElapsed(e);
      if (!manualStage.current) setStageIndexState(stageAt(e).index - 1);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const toggle = useCallback(() => {
    setRunning((r) => {
      if (r) {
        base.current += (Date.now() - (startedAt.current ?? Date.now())) / 1000;
        startedAt.current = null;
      } else {
        startedAt.current = Date.now();
        manualStage.current = false;
      }
      return !r;
    });
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    startedAt.current = null;
    base.current = 0;
    manualStage.current = false;
    setElapsed(0);
    setStageIndexState(0);
  }, []);

  const setStageIndex = useCallback((i: number) => {
    manualStage.current = true;
    setStageIndexState(Math.max(0, Math.min(STAGES.length - 1, i)));
  }, []);

  // ---- navigation
  const go = useCallback((v: ViewId, t?: WorkbenchTab) => {
    setView(v);
    if (t) setTab(t);
    history.replaceState(null, '', v === 'presenter' ? window.location.pathname : `#${v}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ---- active job polling
  const setJobId = useCallback((id: string | null) => {
    store.set('ats.jobId', id);
    setJobIdState(id);
    setJob(null);
    setJobError(null);
  }, []);

  const refreshJob = useCallback(async () => {
    if (!jobId) return;
    try {
      setJob(await api.job(jobId));
      setJobError(null);
    } catch (e) {
      setJobError((e as Error).message);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await api.job(jobId);
        if (stop) return;
        setJob(j);
        setJobError(null);
        if (!TERMINAL.has(j.status)) timer = setTimeout(tick, 2000);
      } catch (e) {
        if (stop) return;
        setJobError((e as Error).message);
        timer = setTimeout(tick, 5000);
      }
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const value = useMemo<DemoState>(() => ({
    view, tab, go, jobId, setJobId, job, jobError, refreshJob,
    clock: { running, elapsed, remaining: TARGET_SECONDS - elapsed, toggle, reset },
    stageIndex, setStageIndex,
  }), [view, tab, go, jobId, setJobId, job, jobError, refreshJob, running, elapsed, toggle, reset, stageIndex, setStageIndex]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo outside DemoProvider');
  return v;
}
