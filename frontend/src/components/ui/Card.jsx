import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('glass rounded-2xl p-6 transition-all duration-300 hover:border-white/20', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

export function CardTitle({ className, children }) {
  return <h3 className={cn('text-lg font-semibold text-white', className)}>{children}</h3>;
}

export function CardDescription({ className, children }) {
  return <p className={cn('text-sm text-slate-400 mt-1', className)}>{children}</p>;
}

export function CardContent({ className, children }) {
  return <div className={cn('', className)}>{children}</div>;
}
