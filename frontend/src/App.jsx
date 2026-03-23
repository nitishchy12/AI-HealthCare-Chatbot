import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalToast from './components/GlobalToast';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChatbotPage = lazy(() => import('./pages/ChatbotPage'));
const HospitalsPage = lazy(() => import('./pages/HospitalsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SymptomCheckerPage = lazy(() => import('./pages/SymptomCheckerPage'));
const HealthHistoryPage = lazy(() => import('./pages/HealthHistoryPage'));
const HealthReportsPage = lazy(() => import('./pages/HealthReportsPage'));
const HealthTipsPage = lazy(() => import('./pages/HealthTipsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function App() {
  const [toast, setToast] = useState('');

  useEffect(() => {
    const onError = (event) => {
      if (event?.detail?.message) {
        setToast(event.detail.message);
      }
    };

    window.addEventListener('app:error', onError);
    return () => window.removeEventListener('app:error', onError);
  }, []);

  return (
    <div className="app">
      <Navbar />
      <GlobalToast message={toast} onClose={() => setToast('')} />
      <Suspense fallback={<div className="route-loader">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/hospitals" element={<HospitalsPage />} />
          <Route path="/tips" element={<HealthTipsPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatbotPage /></ProtectedRoute>} />
          <Route path="/symptom-checker" element={<ProtectedRoute><SymptomCheckerPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HealthHistoryPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><HealthReportsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
