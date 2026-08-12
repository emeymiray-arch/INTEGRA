import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  badge?: string | number;
  active?: boolean;
  onClick?: () => void;
}

export interface SidebarProps {
  logo?: ReactNode;
  title?: string;
  subtitle?: string;
  items: SidebarItem[];
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
}

export function Sidebar({
  logo,
  title = 'INTEGRA',
  subtitle,
  items,
  footer,
  collapsed = false,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-primary-dark/20 bg-primary text-white',
        collapsed ? 'w-[72px]' : 'w-64',
        className,
      )}
    >
      <div className={cn('flex items-center gap-3 border-b border-white/10 p-4', collapsed && 'justify-center')}>
        {logo ?? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/30 font-bold text-white">
            I
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-wide">{title}</p>
            {subtitle && (
              <p className="truncate text-xs text-white/60">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              item.active
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center px-2',
            )}
            title={collapsed ? item.label : undefined}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {footer && (
        <div className={cn('border-t border-white/10 p-3', collapsed && 'flex justify-center')}>
          {footer}
        </div>
      )}
    </aside>
  );
}
