import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-integra-gray-600">История пуста</p>
    );
  }

  return (
    <div className={cn('relative space-y-0', className)}>
      {items.map((item, index) => (
        <div key={item.id} className="relative flex gap-4 pb-8 last:pb-0">
          {index < items.length - 1 && (
            <div className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-integra-gray-200" />
          )}
          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-primary shadow-sm">
            {item.icon ?? (
              <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-integra-gray-900">{item.title}</h4>
              {item.badge}
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-integra-gray-600">{item.description}</p>
            )}
            <time className="mt-1 block text-xs text-integra-gray-400">{item.date}</time>
          </div>
        </div>
      ))}
    </div>
  );
}
