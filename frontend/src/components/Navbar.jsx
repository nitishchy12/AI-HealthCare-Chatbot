import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import {
  Sun, Moon, Menu, X, ChevronDown,
  LayoutDashboard, MessageSquare, Activity, History,
  BarChart2, User, Hospital, Lightbulb, Shield,
  LogOut, Settings, Languages,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/cn';

const navLinks = [
  { to: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard, auth: true  },
  { to: '/chat',            label: 'Chat',            icon: MessageSquare,   auth: true  },
  { to: '/symptom-checker', label: 'Symptoms',        icon: Activity,        auth: true  },
  { to: '/history',         label: 'History',         icon: History,         auth: true  },
  { to: '/reports',         label: 'Reports',         icon: BarChart2,       auth: true  },
  { to: '/tips',            label: 'Health Tips',     icon: Lightbulb,       auth: false },
  { to: '/hospitals',       label: 'Hospitals',       icon: Hospital,        auth: false },
];

function HealthBotLogo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 select-none group">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm group-hover:bg-primary-hover transition-colors">
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 110 18A9 9 0 0112 3z" opacity="0.3" />
        </svg>
      </div>
      <span className="font-bold text-base text-text-primary dark:text-text-dark tracking-tight">
        Health<span className="text-primary">Bot</span>
      </span>
    </NavLink>
  );
}

function NavItem({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors duration-150',
        isActive
          ? 'text-primary bg-primary/10 dark:bg-primary/15'
          : 'text-text-muted dark:text-slate-400 hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/60',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export default function Navbar() {
  const { token, user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleLinks = navLinks.filter((l) => !l.auth || token);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border dark:border-border-dark bg-white/90 dark:bg-surface-dark/90 backdrop-blur-md shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4">

        {/* Logo */}
        <HealthBotLogo />

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
          {visibleLinks.map((l) => (
            <NavItem key={l.to} to={l.to} label={l.label} icon={l.icon} />
          ))}
        </nav>

        {/* Right-side controls */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Language toggle */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={cn(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
                'text-text-muted dark:text-slate-400 hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/60',
              )}>
                <Languages className="w-3.5 h-3.5" />
                {language === 'en' ? 'EN' : 'HI'}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[130px] bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-lg p-1 animate-fade-in"
                sideOffset={6}
              >
                {[{ code: 'en', label: 'English' }, { code: 'hi', label: 'हिंदी' }].map(({ code, label }) => (
                  <DropdownMenu.Item
                    key={code}
                    onSelect={() => setLanguage(code)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded text-sm cursor-pointer outline-none transition-colors',
                      language === code
                        ? 'text-primary font-medium bg-primary/8 dark:bg-primary/15'
                        : 'text-text-muted dark:text-slate-400 hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/50',
                    )}
                  >
                    {language === code && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    {label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded text-text-muted dark:text-slate-400 hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/60 transition-colors"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />}
          </button>

          {/* User menu (authenticated) */}
          {token && user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-border/40 dark:hover:bg-border-dark/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Avatar.Root className="w-7 h-7 rounded-full overflow-hidden bg-primary flex items-center justify-center shrink-0">
                    <Avatar.Fallback className="text-white text-xs font-semibold">{initials}</Avatar.Fallback>
                  </Avatar.Root>
                  <span className="hidden sm:block text-sm font-medium text-text-primary dark:text-text-dark max-w-[100px] truncate">
                    {user.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden sm:block" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 w-56 bg-white dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-xl p-1 animate-fade-in"
                  sideOffset={8}
                  align="end"
                >
                  {/* User info header */}
                  <div className="px-3 py-2.5 border-b border-border dark:border-border-dark mb-1">
                    <p className="text-sm font-semibold text-text-primary dark:text-text-dark truncate">{user.name}</p>
                    <p className="text-xs text-text-muted truncate mt-0.5">{user.email}</p>
                  </div>

                  {[
                    { icon: User,     label: 'Profile',     to: '/profile' },
                    { icon: Settings, label: 'Settings',    to: '/profile' },
                    ...(user.role === 'admin' ? [{ icon: Shield, label: 'Admin Panel', to: '/admin' }] : []),
                  ].map(({ icon: Icon, label, to }) => (
                    <DropdownMenu.Item
                      key={label}
                      onSelect={() => navigate(to)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-text-muted dark:text-slate-400 hover:text-text-primary dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/50 cursor-pointer outline-none transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </DropdownMenu.Item>
                  ))}

                  <DropdownMenu.Separator className="my-1 h-px bg-border dark:bg-border-dark" />

                  <DropdownMenu.Item
                    onSelect={handleLogout}
                    className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-danger hover:bg-danger/8 dark:hover:bg-danger/15 cursor-pointer outline-none transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <NavLink
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
            >
              Sign in
            </NavLink>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="lg:hidden p-2 rounded text-text-muted hover:text-text-primary dark:text-slate-400 dark:hover:text-text-dark hover:bg-border/40 dark:hover:bg-border-dark/60 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-3 flex flex-col gap-1 animate-slide-up">
          {visibleLinks.map((l) => (
            <NavItem key={l.to} to={l.to} label={l.label} icon={l.icon} onClick={() => setMobileOpen(false)} />
          ))}
          {!token && (
            <NavLink
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              Sign in
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
}
