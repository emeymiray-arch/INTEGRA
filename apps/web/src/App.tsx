import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { AppProviders } from '@/app/providers';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { AppLayout } from '@/app/layouts/AppLayout';
import { GuestRoute, ProtectedRoute } from '@/app/routes/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { PatientDetailPage } from '@/features/patients/PatientDetailPage';
import { AppointmentsPage } from '@/features/appointments/AppointmentsPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { ServicesPage } from '@/features/services/ServicesPage';
import { StaffPage } from '@/features/staff/StaffPage';
import { FinancePage } from '@/features/finance/FinancePage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="patients" element={<PatientsPage />} />
              <Route path="patients/:id" element={<PatientDetailPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    </AppProviders>
  );
}
