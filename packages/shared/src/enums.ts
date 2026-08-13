export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum PatientSource {
  REFERRAL = 'REFERRAL',
  WEBSITE = 'WEBSITE',
  SOCIAL = 'SOCIAL',
  WALK_IN = 'WALK_IN',
  ADVERTISING = 'ADVERTISING',
  OTHER = 'OTHER',
}

export enum PatientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum RoleCode {
  ADMIN = 'ADMIN',
  DOCTOR = 'DOCTOR',
  MASSAGE_THERAPIST = 'MASSAGE_THERAPIST',
  MANAGER = 'MANAGER',
  FINANCE = 'FINANCE',
}

export enum AppointmentStatus {
  CREATED = 'CREATED',
  CONFIRMED = 'CONFIRMED',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
}

export enum DiscountType {
  NONE = 'NONE',
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum VisitStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TreatmentPlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DocumentType {
  PHOTO = 'PHOTO',
  MRI = 'MRI',
  CT = 'CT',
  XRAY = 'XRAY',
  LAB = 'LAB',
  PDF = 'PDF',
  DOC = 'DOC',
  OTHER = 'OTHER',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethodType {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  CERTIFICATE = 'CERTIFICATE',
  DEPOSIT = 'DEPOSIT',
  SUBSCRIPTION = 'SUBSCRIPTION',
  OTHER = 'OTHER',
}

export enum StorageProvider {
  LOCAL = 'LOCAL',
  GOOGLE_DRIVE = 'GOOGLE_DRIVE',
  S3 = 'S3',
}

export enum NotificationChannel {
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum FileEntityType {
  Patient = 'Patient',
  MedicalRecord = 'MedicalRecord',
  Visit = 'Visit',
  Appointment = 'Appointment',
  Staff = 'Staff',
  Organization = 'Organization',
  Branch = 'Branch',
}

export const ACTIVITY_EVENTS = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REGISTER: 'auth.register',
  PATIENT_CREATED: 'patient.created',
  PATIENT_UPDATED: 'patient.updated',
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DELETED: 'document.deleted',
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',
  APPOINTMENT_STATUS_CHANGED: 'appointment.status_changed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  PAYMENT_PROCESSED: 'payment.processed',
  PAYMENT_REFUNDED: 'payment.refunded',
  SERVICE_CREATED: 'service.created',
  SERVICE_UPDATED: 'service.updated',
  STAFF_CREATED: 'staff.created',
  INVOICE_ISSUED: 'invoice.issued',
} as const;

export type ActivityEventType = (typeof ACTIVITY_EVENTS)[keyof typeof ACTIVITY_EVENTS];
