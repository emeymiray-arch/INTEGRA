import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleCode,
} from '@integra/shared';
import { PaymentMethodType, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding INTEGRA CRM...');

  const organization = await prisma.organization.upsert({
    where: { slug: 'integra' },
    update: {},
    create: {
      name: 'INTEGRA',
      slug: 'integra',
      legalName: 'ООО «ИНТЕГРА»',
      phone: '+7 (495) 123-45-67',
      email: 'info@integra.ru',
      settings: {
        locale: 'ru-RU',
        currency: 'RUB',
        timezone: 'Europe/Moscow',
      },
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: organization.id,
      name: 'INTEGRA Центр',
      address: 'г. Москва, ул. Примерная, д. 1',
      phone: '+7 (495) 123-45-67',
      email: 'center@integra.ru',
      timezone: 'Europe/Moscow',
      workingHours: {
        mon: { open: '09:00', close: '21:00' },
        tue: { open: '09:00', close: '21:00' },
        wed: { open: '09:00', close: '21:00' },
        thu: { open: '09:00', close: '21:00' },
        fri: { open: '09:00', close: '21:00' },
        sat: { open: '10:00', close: '18:00' },
        sun: null,
      },
    },
  });

  const permissionMap = new Map<string, string>();
  for (const code of Object.values(PERMISSIONS)) {
    const [resource, action] = code.split(':');
    const permission = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: {
        code,
        resource,
        action,
        description: `${resource} ${action}`,
      },
    });
    permissionMap.set(code, permission.id);
  }

  const roleNames: Record<RoleCode, string> = {
    [RoleCode.ADMIN]: 'Администратор',
    [RoleCode.DOCTOR]: 'Врач-остеопат',
    [RoleCode.MASSAGE_THERAPIST]: 'Массажист',
    [RoleCode.MANAGER]: 'Менеджер',
    [RoleCode.FINANCE]: 'Финансист',
  };

  const roleMap = new Map<string, string>();
  for (const code of Object.values(RoleCode)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: roleNames[code],
        isSystem: true,
      },
    });
    roleMap.set(code, role.id);

    for (const permCode of ROLE_PERMISSIONS[code]) {
      const permissionId = permissionMap.get(permCode);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@integra.ru' },
    update: { passwordHash },
    create: {
      email: 'admin@integra.ru',
      passwordHash,
    },
  });

  const adminStaff = await prisma.staff.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: organization.id,
      branchId: branch.id,
      firstName: 'Админ',
      lastName: 'INTEGRA',
      specialization: 'Администратор системы',
      phone: '+7 (900) 000-00-01',
    },
  });

  const adminRoleId = roleMap.get(RoleCode.ADMIN)!;
  await prisma.staffRole.upsert({
    where: {
      staffId_roleId: { staffId: adminStaff.id, roleId: adminRoleId },
    },
    update: { revokedAt: null },
    create: {
      staffId: adminStaff.id,
      roleId: adminRoleId,
    },
  });

  const categories = [
    { slug: 'osteopathy', name: 'Остеопатия', sortOrder: 1 },
    { slug: 'massage', name: 'Массаж', sortOrder: 2 },
    { slug: 'rehabilitation', name: 'Реабилитация', sortOrder: 3 },
  ];

  const categoryIds = new Map<string, string>();
  for (const cat of categories) {
    const created = await prisma.serviceCategory.upsert({
      where: {
        organizationId_slug: { organizationId: organization.id, slug: cat.slug },
      },
      update: {},
      create: {
        organizationId: organization.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
      },
    });
    categoryIds.set(cat.slug, created.id);
  }

  const services = [
    {
      category: 'osteopathy',
      name: 'Первичный приём остеопата',
      durationMinutes: 60,
      price: 5000,
    },
    {
      category: 'osteopathy',
      name: 'Повторный приём остеопата',
      durationMinutes: 45,
      price: 4000,
    },
    {
      category: 'massage',
      name: 'Лечебный массаж (60 мин)',
      durationMinutes: 60,
      price: 3500,
    },
    {
      category: 'massage',
      name: 'Спортивный массаж (90 мин)',
      durationMinutes: 90,
      price: 5000,
    },
    {
      category: 'rehabilitation',
      name: 'Кинезиотейпирование',
      durationMinutes: 30,
      price: 2000,
    },
    {
      category: 'rehabilitation',
      name: 'ЛФК (индивидуальное занятие)',
      durationMinutes: 60,
      price: 3000,
    },
  ];

  for (const svc of services) {
    const existing = await prisma.service.findFirst({
      where: { organizationId: organization.id, name: svc.name },
    });
    if (!existing) {
      await prisma.service.create({
        data: {
          organizationId: organization.id,
          categoryId: categoryIds.get(svc.category),
          name: svc.name,
          durationMinutes: svc.durationMinutes,
          price: svc.price,
        },
      });
    }
  }

  const paymentMethods = [
    { code: 'cash', name: 'Наличные', type: PaymentMethodType.CASH },
    { code: 'card', name: 'Банковская карта', type: PaymentMethodType.CARD },
    { code: 'transfer', name: 'Безналичный перевод', type: PaymentMethodType.TRANSFER },
    { code: 'certificate', name: 'Подарочный сертификат', type: PaymentMethodType.CERTIFICATE },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: {
        organizationId_code: { organizationId: organization.id, code: pm.code },
      },
      update: {},
      create: {
        organizationId: organization.id,
        code: pm.code,
        name: pm.name,
        type: pm.type,
      },
    });
  }

  console.log('Seed completed.');
  console.log('  Organization:', organization.name);
  console.log('  Branch:', branch.name);
  console.log('  Admin: admin@integra.ru / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
