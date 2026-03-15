import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ChatbotPage from './pages/ChatbotPage';
import HospitalsPage from './pages/HospitalsPage';
import AdminPage from './pages/AdminPage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import HealthHistoryPage from './pages/HealthHistoryPage';
import HealthReportsPage from './pages/HealthReportsPage';
import HealthTipsPage from './pages/HealthTipsPage';
import NotFoundPage from './pages/NotFoundPage';
import GlobalToast from './components/GlobalToast';

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
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
