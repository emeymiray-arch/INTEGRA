import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { formatMoney } from '@integra/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@integra/ui';
import { apiClient, type Service } from '@/shared/api/client';

export function ServicesPage() {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services');
      return (data?.data ?? data ?? []) as Service[];
    },
  });

  return (
    <div>
      <PageHeader
        title="Услуги"
        description="Справочник услуг медицинского центра"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Добавить услугу
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          title="Услуги не найдены"
          description="Добавьте первую услугу в справочник"
          action={{ label: 'Добавить услугу', onClick: () => {} }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-integra-gray-900">{service.name}</h3>
                  {service.category && (
                    <p className="mt-0.5 text-xs text-integra-gray-600">{service.category.name}</p>
                  )}
                </div>
                <Badge variant={service.isActive ? 'success' : 'muted'}>
                  {service.isActive ? 'Активна' : 'Неактивна'}
                </Badge>
              </div>
              {service.description && (
                <p className="mt-3 line-clamp-2 text-sm text-integra-gray-600">
                  {service.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-integra-gray-100 pt-4">
                <span className="text-sm text-integra-gray-600">
                  {service.durationMinutes} мин
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatMoney(service.price)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
