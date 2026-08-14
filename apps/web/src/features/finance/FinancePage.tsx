import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asList, formatMoney } from '@integra/shared';
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  StatCard,
  type DataTableColumn,
} from '@integra/ui';
import { DollarSign, FileText, Plus, TrendingUp, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient, type DashboardStats, type Debt, type Invoice } from '@/shared/api/client';
import { cardItem, cardStagger } from '@/shared/lib/motion';
import { formatDate } from '@/shared/lib/format';
import { PERMISSIONS, useCan } from '@/shared/lib/permissions';
import { apiErrorMessage } from '@/shared/api/errorMessage';
import { CreateDebtDialog } from './CreateDebtDialog';

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
  const queryClient = useQueryClient();
  const canWriteFinance = useCan(PERMISSIONS.FINANCE_WRITE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [includeSettled, setIncludeSettled] = useState(false);

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

  const {
    data: debtsData,
    isLoading: debtsLoading,
    isError: debtsError,
  } = useQuery({
    queryKey: ['debts', includeSettled],
    queryFn: async () => {
      const { data } = await apiClient.get('/finance/debts', {
        params: includeSettled ? { includeSettled: 'true' } : undefined,
      });
      return data as { items?: Debt[]; totalOpen?: number; countOpen?: number };
    },
  });

  const settle = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/finance/debts/${id}/settle`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debts'] }),
  });

  const removeDebt = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/debts/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debts'] }),
  });

  const invoices = asList<Invoice>(data);
  const debts = asList<Debt>(debtsData);
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

  const debtColumns: DataTableColumn<Debt>[] = [
    { key: 'debtorName', header: 'Должник' },
    {
      key: 'amount',
      header: 'Сумма долга',
      render: (row) => formatMoney(Number(row.amount)),
    },
    {
      key: 'note',
      header: 'Примечание',
      render: (row) => row.note?.trim() || '—',
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) =>
        row.settledAt ? <Badge variant="success">Погашен</Badge> : <Badge variant="warning">Открыт</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        canWriteFinance ? (
          <div className="flex justify-end gap-2">
            {!row.settledAt && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (window.confirm('Отметить долг как погашенный?')) settle.mutate(row.id);
                }}
              >
                Погасить
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm('Удалить запись о долге?')) removeDebt.mutate(row.id);
              }}
            >
              Удалить
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Финансы" description="Счета, оплаты и долги" />

      <motion.div
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
        <motion.div variants={cardItem}>
          <StatCard
            title="Открытые долги"
            value={formatMoney(debtsData?.totalOpen ?? 0)}
            subtitle={
              debtsData?.countOpen
                ? `${debtsData.countOpen} ${debtsData.countOpen === 1 ? 'запись' : 'записей'}`
                : 'Нет открытых'
            }
            icon={<Wallet className="h-6 w-6" />}
          />
        </motion.div>
      </motion.div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-integra-gray-900">Долги</h2>
          <p className="text-sm text-integra-gray-600">Должники, сумма и примечание</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-integra-gray-600">
            <input
              type="checkbox"
              checked={includeSettled}
              onChange={(event) => setIncludeSettled(event.target.checked)}
              className="h-4 w-4 rounded border-integra-gray-300"
            />
            Показать погашенные
          </label>
          {canWriteFinance && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Добавить долг
            </Button>
          )}
        </div>
      </div>

      {debtsError && (
        <p className="mb-4 text-sm text-integra-error">Не удалось загрузить долги</p>
      )}
      {(settle.isError || removeDebt.isError) && (
        <p className="mb-4 text-sm text-integra-error">
          {apiErrorMessage(settle.error ?? removeDebt.error, 'Не удалось обновить долг')}
        </p>
      )}

      <DataTable
        columns={debtColumns}
        data={debts}
        keyExtractor={(row) => row.id}
        loading={debtsLoading}
        emptyMessage="Долгов нет"
      />

      <h2 className="mb-1 mt-10 text-lg font-semibold text-integra-gray-900">Счета</h2>
      <p className="mb-4 text-sm text-integra-gray-600">Выставленные счета и оплаты</p>

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

      <CreateDebtDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
