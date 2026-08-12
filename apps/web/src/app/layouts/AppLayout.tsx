import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Stethoscope,
  UserCog,
  Users,
} from 'lucide-react';
import { AppShell, Avatar, Button } from '@integra/ui';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { useAuthStore } from '@/shared/stores/authStore';
import { pageTransition } from '@/shared/lib/motion';
import { fullName } from '@/shared/lib/format';

const navItems = [
  { id: 'dashboard', label: 'Дашборд', path: '/', icon: LayoutDashboard },
  { id: 'patients', label: 'Пациенты', path: '/patients', icon: Users },
  { id: 'appointments', label: 'Записи', path: '/appointments', icon: Calendar },
  { id: 'schedule', label: 'Расписание', path: '/schedule', icon: CalendarDays },
  { id: 'services', label: 'Услуги', path: '/services', icon: Stethoscope },
  { id: 'staff', label: 'Сотрудники', path: '/staff', icon: UserCog },
  { id: 'finance', label: 'Финансы', path: '/finance', icon: CreditCard },
  { id: 'settings', label: 'Настройки', path: '/settings', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { staff, logout } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const sidebarItems = useMemo(
    () =>
      navItems.map((item) => ({
        id: item.id,
        label: item.label,
        icon: <item.icon className="h-5 w-5" strokeWidth={1.5} />,
        active:
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path),
        onClick: () => navigate(item.path),
      })),
    [location.pathname, navigate],
  );

  const staffName = staff ? fullName(staff) : 'Пользователь';

  return (
    <>
      <AppShell
        sidebarItems={sidebarItems}
        sidebarFooter={
          <div className="flex w-full items-center gap-3 rounded-xl bg-white/10 p-2">
            <Avatar name={staffName} src={staff?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{staffName}</p>
              <p className="truncate text-xs text-white/60">{staff?.specialization ?? 'CRM'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        }
        header={
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-integra-gray-600">Добро пожаловать</p>
              <p className="font-semibold text-integra-gray-900">{staffName}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Поиск</span>
              <kbd className="hidden rounded border border-integra-gray-200 bg-integra-gray-50 px-1.5 py-0.5 text-xs text-integra-gray-600 md:inline">
                ⌘K
              </kbd>
            </Button>
          </div>
        }
      >
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} {...pageTransition}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </AppShell>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
