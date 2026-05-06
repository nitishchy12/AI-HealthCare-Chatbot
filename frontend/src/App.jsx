import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Spinner from './components/ui/Spinner';

const LandingPage       = lazy(() => import('./pages/LandingPage'));
const LoginPage         = lazy(() => import('./pages/LoginPage'));
const RegisterPage      = lazy(() => import('./pages/RegisterPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const ChatbotPage       = lazy(() => import('./pages/ChatbotPage'));
const HospitalsPage     = lazy(() => import('./pages/HospitalsPage'));
const AdminPage         = lazy(() => import('./pages/AdminPage'));
const SymptomCheckerPage = lazy(() => import('./pages/SymptomCheckerPage'));
const HealthHistoryPage = lazy(() => import('./pages/HealthHistoryPage'));
const HealthReportsPage = lazy(() => import('./pages/HealthReportsPage'));
const HealthTipsPage    = lazy(() => import('./pages/HealthTipsPage'));
const ProfilePage       = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <div className="app min-h-screen bg-background dark:bg-background-dark transition-colors duration-200">
      <Navbar />

      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
          },
          success: {
            iconTheme: { primary: '#0F766E', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
          },
        }}
      />

      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"              element={<LandingPage />} />
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/register"      element={<RegisterPage />} />
            <Route path="/hospitals"     element={<HospitalsPage />} />
            <Route path="/tips"          element={<HealthTipsPage />} />
            <Route path="/dashboard"     element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/chat"          element={<ProtectedRoute><ChatbotPage /></ProtectedRoute>} />
            <Route path="/symptom-checker" element={<ProtectedRoute><SymptomCheckerPage /></ProtectedRoute>} />
            <Route path="/history"       element={<ProtectedRoute><HealthHistoryPage /></ProtectedRoute>} />
            <Route path="/reports"       element={<ProtectedRoute><HealthReportsPage /></ProtectedRoute>} />
            <Route path="/profile"       element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/admin"         element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
            <Route path="*"              element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
