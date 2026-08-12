import { type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Sidebar, type SidebarItem } from './Sidebar';

export interface AppShellProps {
  sidebarItems: SidebarItem[];
  sidebarFooter?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function AppShell({
  sidebarItems,
  sidebarFooter,
  header,
  children,
  title = 'INTEGRA',
  subtitle = 'Целостный подход к здоровью',
  className,
}: AppShellProps) {
  return (
    <div className={cn('flex h-screen overflow-hidden bg-background', className)}>
      <Sidebar
        title={title}
        subtitle={subtitle}
        items={sidebarItems}
        footer={sidebarFooter}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header && (
          <header className="shrink-0 border-b border-integra-gray-100 bg-white px-6 py-4">
            {header}
          </header>
        )}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
