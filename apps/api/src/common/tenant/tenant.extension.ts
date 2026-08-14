import { getTenantId } from './tenant-context';

const TENANT_MODELS = new Set([
  'Branch',
  'Staff',
  'Patient',
  'MedicalRecord',
  'Visit',
  'TreatmentPlan',
  'ServiceCategory',
  'Service',
  'Appointment',
  'Invoice',
  'Debt',
  'PaymentMethod',
  'Payment',
  'Refund',
  'File',
  'AuditLog',
  'ActivityLog',
  'NotificationTemplate',
  'NotificationLog',
]);

const SCOPED_READ = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

const SCOPED_CREATE = new Set(['create', 'createMany', 'createManyAndReturn']);

function withOrganizationId(where: unknown, organizationId: string) {
  if (!where || typeof where !== 'object' || Array.isArray(where)) {
    return { organizationId };
  }
  return { ...(where as Record<string, unknown>), organizationId };
}

function stampCreateData(data: unknown, organizationId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => stampCreateData(row, organizationId));
  }
  if (!data || typeof data !== 'object') return data;
  const row = data as Record<string, unknown>;
  if (row.organization && typeof row.organization === 'object') return row;
  return { ...row, organizationId };
}

export const tenantQueryExtension = {
  query: {
    $allModels: {
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model: string;
        operation: string;
        args: Record<string, unknown>;
        query: (args: Record<string, unknown>) => Promise<unknown>;
      }) {
        const organizationId = getTenantId();
        if (!organizationId || !TENANT_MODELS.has(model)) {
          return query(args);
        }

        if (SCOPED_READ.has(operation)) {
          args.where = withOrganizationId(args.where, organizationId);
        }

        if (SCOPED_CREATE.has(operation) && args.data) {
          args.data = stampCreateData(args.data, organizationId);
        }

        return query(args);
      },
    },
  },
};
