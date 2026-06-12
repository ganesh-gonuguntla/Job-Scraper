import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-brand-500/20 text-brand-300 border-brand-500/30',
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  danger: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  accent: 'bg-accent-500/20 text-pink-300 border-accent-500/30',
};

export function Badge({ className, variant = 'default', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
