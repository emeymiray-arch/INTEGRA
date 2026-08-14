import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { asList, formatMoney } from '@integra/shared';
import {
  Badge,
  DataTable,
  PageHeader,
  StatCard,
  type DataTableColumn,
} from '@integra/ui';
import { DollarSign, FileText, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient, type DashboardStats, type Invoice } from '@/shared/api/client';
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

  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/analytics/dashboard');
      return data;
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoices', page],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/invoices', {
        params: { page, limit: 20 },
      });
      return data as { items?: Invoice[]; total?: number; page?: number; limit?: number };
    },
  });

  const invoices = asList<Invoice>(data);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? invoices.length) / (data?.limit ?? 20)));

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
      render: (row) => formatMoney(Number(row.totalAmount)),
    },
    {
      key: 'paidAmount',
      header: 'Оплачено',
      render: (row) => formatMoney(Number(row.paidAmount)),
    },
    {
      key: 'balance',
      header: 'Остаток',
      render: (row) => formatMoney(Number(row.balance)),
    },
    {
      key: 'issuedAt',
      header: 'Дата',
      render: (row) => (row.issuedAt ? formatDate(row.issuedAt) : '—'),
    },
  ];

  return (
    <div>
      <PageHeader title="Финансы" description="Счета и оплаты" />

      <motion.div
        className="mb-8 grid gap-4 sm:grid-cols-3"
        variants={cardStagger}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={cardItem}>
          <StatCard
            title="Выручка за месяц"
            value={formatMoney(stats?.monthRevenue ?? 0)}
            icon={<DollarSign className="h-6 w-6" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Неоплаченные счета"
            value={stats?.pendingInvoices ?? 0}
            icon={<FileText className="h-6 w-6" />}
          />
        </motion.div>
        <motion.div variants={cardItem}>
          <StatCard
            title="Выручка сегодня"
            value={formatMoney(stats?.todayRevenue ?? 0)}
            icon={<TrendingUp className="h-6 w-6" />}
          />
        </motion.div>
      </motion.div>

      {isError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить счета</p>
      )}

      <DataTable
        columns={columns}
        data={invoices}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        page={data?.page ?? page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyMessage="Счета отсутствуют"
      />
    </div>
  );
}
