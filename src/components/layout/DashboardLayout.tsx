import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building,
  Globe,
  ShoppingBag,
  Package,
  MessageSquare,
  Settings,
  LogOut,
  X,
  ShieldCheck,
  BadgeCheck,
  Tag,
  Plus,
  FileText,
  Menu
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import { Global3DBackground } from '@/components/Global3DBackground';
import { RealTimeInsights } from '@/components/RealTimeInsights';

export function DashboardLayout() {
  const { user, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  // The live-data widget renders only on the dashboard home page. Market
  // Intelligence renders its own region-aware instance instead.
  const showLiveInsights = location.pathname === '/dashboard';

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setDesktopCollapsed((c) => !c);
    } else {
      setSidebarOpen((o) => !o);
    }
  };

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'government_officer';
  const isSmeOwner = profile?.role === 'sme_owner';
  const isBuyer = profile?.role === 'buyer';

  // Market Intelligence, HS Classification and Compliance are exporter tools —
  // buyers don't need them, so hide them from buyer navigation.
  const buyerHiddenHrefs = ['/dashboard/intelligence', '/dashboard/hs-classification', '/dashboard/compliance'];

  const navigation = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('company_profile'), href: '/dashboard/company', icon: Building },
    { name: t('intelligence'), href: '/dashboard/intelligence', icon: Globe },
    { name: t('hs_classification'), href: '/dashboard/hs-classification', icon: Tag },
    { name: t('marketplace'), href: '/dashboard/marketplace', icon: ShoppingBag },
    ...(isSmeOwner ? [{ name: t('create_listing'), href: '/dashboard/marketplace/create', icon: Plus }] : []),
    // Cart/Orders live in-page (marketplace header) rather than the sidebar;
    // selling visibility is sme_owner-only (SmeOwnerRoute).
    ...(isSmeOwner ? [
      { name: t('Received Orders'), href: '/dashboard/sales', icon: Package },
    ] : []),
    { name: t('messages'), href: '/dashboard/messages', icon: MessageSquare },
    { name: t('compliance'), href: '/dashboard/compliance', icon: ShieldCheck },
    ...(isAdmin ? [
      { name: t('verify_companies'), href: '/dashboard/admin/verify', icon: BadgeCheck },
      { name: t('audit_logs'), href: '/dashboard/admin/audit', icon: FileText },
    ] : []),
    { name: t('settings'), href: '/dashboard/settings', icon: Settings },
  ].filter((item) => !(isBuyer && buyerHiddenHrefs.includes(item.href)));

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg flex overflow-hidden">
      <Global3DBackground />

      {/* Mobile sidebar overlay */}
      <div 
        role="button"
        tabIndex={-1}
        aria-label={t('Close sidebar')}
        className={`fixed inset-0 z-20 bg-surface-950/80 backdrop-blur-sm transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setSidebarOpen(false);
        }}
      />

      {/* Sidebar */}
      <aside className={`inset-y-0 left-0 z-30 w-72 flex flex-col glass-strong border-r border-border transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${
        desktopCollapsed
          ? 'lg:absolute lg:-translate-x-full'
          : 'lg:static lg:inset-0 lg:translate-x-0'
      }`}>
        <div className="h-16 flex items-center px-6 border-b border-border/50 justify-between lg:justify-center">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary-500" />
            <span className="text-xl font-black tracking-tight text-text-primary">Brooke</span>
          </Link>
          <button className="lg:hidden text-text-secondary hover:text-text-primary" onClick={() => setSidebarOpen(false)} aria-label={t('Close sidebar')}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20 shadow-inner' 
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-4 py-3 bg-bg-tertiary rounded-xl border border-border">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold shrink-0">
              {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {profile?.full_name || t('User')}
              </p>
              <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
            </div>
            <button 
              onClick={handleSignOut}
              className="text-text-tertiary hover:text-danger-500 transition-colors p-1"
              title={t('Sign Out')}
              aria-label={t('Sign Out')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col w-0 overflow-hidden">
        {/* Top navigation bar completely removed per request */}

        <main data-scroll-root className="app-content flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-8 lg:pt-12">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t('Open menu')}
            className="mb-4 -ml-1 p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="max-w-7xl w-full mx-auto animate-fade-in">
            {showLiveInsights && <RealTimeInsights targetRegion="South Asia" />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
