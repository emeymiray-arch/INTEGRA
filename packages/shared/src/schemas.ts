import { z } from 'zod';
import {
  DiscountType,
  Gender,
  PatientSource,
  PatientStatus,
  RoleCode,
  AppointmentStatus,
} from './enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  relation: z.string().optional(),
});

export const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  emergencyContact: emergencyContactSchema.optional(),
  allergies: z.string().optional(),
  contraindications: z.string().optional(),
  chronicDiseases: z.string().optional(),
  notes: z.string().optional(),
  preferredBranchId: z.string().uuid().optional(),
  primaryStaffId: z.string().uuid().optional(),
  source: z.nativeEnum(PatientSource).optional(),
  status: z.nativeEnum(PatientStatus).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  branchId: z.string().uuid(),
  specialization: z.string().optional(),
  phone: z.string().optional(),
  roleCodes: z.array(z.nativeEnum(RoleCode)).min(1),
});

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  branchId: z.string().uuid(),
  startsAt: z.string().datetime(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
  reason: z.string().optional(),
});

export const rescheduleAppointmentSchema = z.object({
  startsAt: z.string().datetime(),
  reason: z.string().optional(),
});

export const createServiceSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  price: z.number().min(0),
});

export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethodId: z.string().uuid(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
