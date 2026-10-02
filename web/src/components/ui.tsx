import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CheckCircle2, CircleAlert, CircleDashed, Loader2, XCircle } from 'lucide-react';
import type { Severity } from '../lib/types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-3xl border border-line bg-ink-900', className)}>{children}</section>;
}

export function Inset({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-ink-925', className)}>{children}</div>;
}

export function Button({ variant = 'primary', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'ghost' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-amber text-[#111] hover:bg-amber-soft',
        variant === 'outline' && 'border border-amber/60 bg-amber-deep/40 text-amber hover:bg-amber-deep',
        variant === 'ghost' && 'border border-line-strong text-fg-muted hover:border-fg-dim hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

const SEV: Record<Severity, string> = {
  critical: 'bg-bad/15 text-bad border-bad/30',
  high: 'bg-warn/10 text-warn border-warn/30',
  medium: 'bg-amber/10 text-amber-soft border-amber/20',
  low: 'bg-cyan/10 text-cyan border-cyan/20',
  info: 'bg-ink-800 text-fg-muted border-line',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={cx('inline-flex rounded-md border px-1.5 py-0.5 font-mono text-[11px] uppercase', SEV[severity])}>{severity}</span>;
}

export function Chip({ children, tone = 'default', title, onClick, active }: { children: ReactNode; tone?: 'default' | 'amber' | 'ok' | 'bad'; title?: string; onClick?: () => void; active?: boolean }) {
  const cls = cx(
    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px]',
    tone === 'default' && 'border-line-strong bg-ink-850 text-fg-muted',
    tone === 'amber' && 'border-amber/40 bg-amber-deep/50 text-amber',
    tone === 'ok' && 'border-ok/30 bg-ok/10 text-ok',
    tone === 'bad' && 'border-bad/30 bg-bad/10 text-bad',
    onClick && 'cursor-pointer hover:border-amber hover:text-amber',
    active && 'ring-1 ring-amber',
  );
  return onClick ? <button type="button" className={cls} title={title} onClick={onClick}>{children}</button> : <span className={cls} title={title}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'amber' | 'ok' | 'bad' }) {
  return (
    <Inset className="px-4 py-3">
      <div className="label">{label}</div>
      <div className={cx('mt-1 font-mono text-2xl font-semibold', tone === 'amber' && 'text-amber', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-dim">{sub}</div>}
    </Inset>
  );
}

export function StatusIcon({ state, size = 18 }: { state: 'done' | 'active' | 'pending' | 'failed' | 'warn'; size?: number }) {
  if (state === 'done') return <CheckCircle2 size={size} className="text-teal" />;
  if (state === 'active') return <Loader2 size={size} className="animate-spin text-amber" />;
  if (state === 'failed') return <XCircle size={size} className="text-bad" />;
  if (state === 'warn') return <CircleAlert size={size} className="text-warn" />;
  return <CircleDashed size={size} className="text-fg-dim" />;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-fg-dim">{icon}</div>}
      <div className="text-lg font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-fg-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{children}</div>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cx('label mb-3', className)}>{children}</h3>;
}
