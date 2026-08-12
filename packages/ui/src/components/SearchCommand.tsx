import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SearchCommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  group?: string;
  keywords?: string[];
  onSelect: () => void;
}

export interface SearchCommandProps {
  open: boolean;
  onClose: () => void;
  items: SearchCommandItem[];
  placeholder?: string;
  loading?: boolean;
  onSearch?: (query: string) => void;
}

export function SearchCommand({
  open,
  onClose,
  items,
  placeholder = 'Поиск пациентов, записей, услуг...',
  loading = false,
  onSearch,
}: SearchCommandProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, SearchCommandItem[]>();
    filtered.forEach((item) => {
      const group = item.group ?? 'Результаты';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    });
    return map;
  }, [filtered]);

  const flatItems = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && flatItems[activeIndex]) {
        e.preventDefault();
        flatItems[activeIndex].onSelect();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, flatItems, activeIndex]);

  useEffect(() => {
    onSearch?.(query);
  }, [query, onSearch]);

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
      <div className="absolute inset-0 bg-primary-dark/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="flex items-center gap-3 border-b border-integra-gray-100 px-4">
          <Search className="h-5 w-5 shrink-0 text-integra-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder={placeholder}
            className="h-14 w-full bg-transparent text-sm text-integra-gray-900 placeholder:text-integra-gray-400 focus:outline-none"
          />
          <kbd className="hidden rounded border border-integra-gray-200 bg-integra-gray-50 px-2 py-0.5 text-xs text-integra-gray-600 sm:inline">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div className="px-3 py-8 text-center text-sm text-integra-gray-600">
              Поиск...
            </div>
          )}
          {!loading && flatItems.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-integra-gray-600">
              Ничего не найдено
            </div>
          )}
          {!loading &&
            Array.from(groups.entries()).map(([group, groupItems]) => (
              <div key={group} className="mb-2">
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-integra-gray-400">
                  {group}
                </p>
                {groupItems.map((item) => {
                  itemIndex += 1;
                  const idx = itemIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.onSelect();
                        onClose();
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                        idx === activeIndex
                          ? 'bg-primary/10 text-primary'
                          : 'text-integra-gray-900 hover:bg-integra-gray-50',
                      )}
                    >
                      {item.icon && (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-integra-gray-100 text-integra-gray-600">
                          {item.icon}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-xs text-integra-gray-600">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
