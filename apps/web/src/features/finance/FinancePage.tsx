import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@integra/shared';
import {
  Badge,
  DataTable,
  PageHeader,
  StatCard,
  type DataTableColumn,
} from '@integra/ui';
import { DollarSign, FileText, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient, type Invoice } from '@/shared/api/client';
import { cardItem, cardStagger } from '@/shared/lib/motion';
import { formatDate } from '@/shared/lib/format';

const invoiceStatusVariant: Record<string, 'muted' | 'info' | 'accent' | 'success' | 'warning'> = {
  DRAFT: 'muted',
  ISSUED: 'info',
  PARTIAL: 'accent',
  PAID: 'success',
  CANCELLED: 'muted',
  REFUNDED: 'warning',
};

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: 'Черновик',
  ISSUED: 'Выставлен',
  PARTIAL: 'Частично',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
  REFUNDED: 'Возврат',
};

export function FinancePage() {
  const [page, setPage] = useState(1);

  const { data: revenue } = useQuery({
    queryKey: ['revenue'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/revenue');
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page],
    queryFn: async () => {
      const { data } = await apiClient.get('/invoices', {
        params: { page, limit: 20 },
      });
      return data;
    },
  });

  const invoices: Invoice[] = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, totalPages: 1 };

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'number', header: 'Номер' },
    {
      key: 'patient',
      header: 'Пациент',
      render: (row) =>
        row.patient ? `${row.patient.lastName} ${row.patient.firstName}` : '—',
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <Badge variant={invoiceStatusVariant[row.status] ?? 'muted'}>
          {invoiceStatusLabels[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Сумма',
      render: (row) => formatMoney(row.totalAmount),
    },
    {
      key: 'paidAmount',
      header: 'Оплачено',
      render: (row) => formatMoney(row.paidAmount),
    },
    {
      key: 'balance',
      header: 'Остаток',
      render: (row) => (
        <span className={row.balance > 0 ? 'font-medium text-accent' : ''}>
          {formatMoney(row.balance)}
        </span>
      ),
    },
    {
      key: 'issuedAt',
      header: 'Дата',
      render: (row) => (row.issuedAt ? formatDate(row.issuedAt) : '—'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Финансы"
        description="Счета, оплаты и финансовая аналитика"
      />

      <motion.div
        className="mb-8 grid gap-4 sm:grid-cols-3"
        variants={cardStagger}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={cardItem}>
          <StatCard
            title="Выручка за месяц"
            value={formatMoney(revenue?.monthly ?? 0)}
            icon={<DollarSign className="h-6 w-6" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Счетов выставлено"
            value={revenue?.invoicesCount ?? 0}
            icon={<FileText className="h-6 w-6" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Средний чек"
            value={formatMoney(revenue?.averageCheck ?? 0)}
            icon={<TrendingUp className="h-6 w-6" />}
            trend={{ value: '+8% к прошлому месяцу', positive: true }}
          />
        </motion.div>
      </motion.div>

      <DataTable
        columns={columns}
        data={invoices}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        page={meta.page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        emptyMessage="Счета отсутствуют"
      />
    </div>
  );
}
