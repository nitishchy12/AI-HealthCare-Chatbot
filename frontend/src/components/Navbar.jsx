import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';

function Navbar() {
  const { token, user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  return (
    <nav className="nav">
      <Link to="/" className="brand">{t.appName}</Link>
      <div className="nav-links">
        {token && <Link to="/dashboard">{t.dashboard}</Link>}
        {token && <Link to="/chat">{t.chat}</Link>}
        {token && <Link to="/symptom-checker">{t.symptomChecker}</Link>}
        {token && <Link to="/history">{t.history}</Link>}
        {token && <Link to="/reports">{t.reports}</Link>}
        {token && <Link to="/profile">{t.profile}</Link>}
        <Link to="/tips">{t.healthTips}</Link>
        <Link to="/hospitals">{t.hospitals}</Link>
        {user?.role === 'admin' && <Link to="/admin">{t.admin}</Link>}
        <button type="button" className="language-toggle" onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}>
          {t.languageToggle}
        </button>
        {token ? <button onClick={logout}>{t.logout}</button> : <Link to="/login">{t.login}</Link>}
      </div>
    </nav>
  );
}

export default Navbar;
