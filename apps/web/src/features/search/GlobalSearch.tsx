import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Stethoscope,
  UserCog,
  Users,
} from 'lucide-react';
import { SearchCommand, type SearchCommandItem } from '@integra/ui';
import { apiClient, type SearchResult } from '@/shared/api/client';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const typeIcons = {
  patient: Users,
  appointment: Calendar,
  service: Stethoscope,
  staff: UserCog,
};

const typeLabels = {
  patient: 'Пациенты',
  appointment: 'Записи',
  service: 'Услуги',
  staff: 'Сотрудники',
};

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data } = await apiClient.get('/search', { params: { q: query } });
      return (data?.results ?? data ?? []) as SearchResult[];
    },
    enabled: open && query.trim().length >= 2,
  });

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const items: SearchCommandItem[] = useMemo(
    () =>
      results.map((result) => {
        const Icon = typeIcons[result.type];
        const paths: Record<SearchResult['type'], string> = {
          patient: `/patients/${result.id}`,
          appointment: '/appointments',
          service: '/services',
          staff: '/staff',
        };
        return {
          id: `${result.type}-${result.id}`,
          label: result.title,
          description: result.subtitle,
          group: typeLabels[result.type],
          icon: <Icon className="h-4 w-4" />,
          keywords: [result.type, result.subtitle ?? ''],
          onSelect: () => navigate(paths[result.type]),
        };
      }),
    [results, navigate],
  );

  return (
    <SearchCommand
      open={open}
      onClose={onClose}
      items={items}
      loading={isFetching}
      onSearch={setQuery}
      placeholder="Поиск пациентов, записей, услуг, сотрудников..."
    />
  );
}
