import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

// Contexts
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ForexProvider } from './contexts/ForexContext';
import { CartProvider } from './contexts/CartContext';
import { useTranslation } from './contexts/I18nContext';

// Pages & Components
import { ErrorBoundary } from './components/ErrorBoundary';
import { initAnalytics } from './lib/analytics';
import { AuthLayout } from './pages/auth/AuthLayout';
import { Landing } from './pages/landing/Landing';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Toaster } from 'sonner';

initAnalytics();

// Lazy-loaded route pages (code splitting: each chunk loads on first visit)
const Login = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })));
const CompanyProfile = lazy(() => import('./pages/dashboard/CompanyProfile').then(m => ({ default: m.CompanyProfile })));
const MarketIntelligence = lazy(() => import('./pages/dashboard/MarketIntelligence').then(m => ({ default: m.MarketIntelligence })));
const Marketplace = lazy(() => import('./pages/dashboard/Marketplace').then(m => ({ default: m.Marketplace })));
const MarketplaceDetail = lazy(() => import('./pages/dashboard/MarketplaceDetail').then(m => ({ default: m.MarketplaceDetail })));
const Messages = lazy(() => import('./pages/dashboard/Messages').then(m => ({ default: m.Messages })));
const Compliance = lazy(() => import('./pages/dashboard/Compliance').then(m => ({ default: m.Compliance })));
const Settings = lazy(() => import('./pages/dashboard/Settings').then(m => ({ default: m.Settings })));
const HSCodeClassification = lazy(() => import('./pages/dashboard/HSCodeClassification').then(m => ({ default: m.HSCodeClassification })));
const VerifyCompanies = lazy(() => import('./pages/dashboard/VerifyCompanies').then(m => ({ default: m.VerifyCompanies })));
const AuditLogs = lazy(() => import('./pages/dashboard/AuditLogs').then(m => ({ default: m.AuditLogs })));
const CreateListing = lazy(() => import('./pages/dashboard/CreateListing').then(m => ({ default: m.CreateListing })));
const Cart = lazy(() => import('./pages/dashboard/Cart').then(m => ({ default: m.Cart })));
const Orders = lazy(() => import('./pages/dashboard/Orders').then(m => ({ default: m.Orders })));
const OrderDetail = lazy(() => import('./pages/dashboard/Orders').then(m => ({ default: m.OrderDetail })));
const CheckoutSuccess = lazy(() => import('./pages/dashboard/CheckoutSuccess').then(m => ({ default: m.CheckoutSuccess })));
const CheckoutCancel = lazy(() => import('./pages/dashboard/CheckoutSuccess').then(m => ({ default: m.CheckoutCancel })));
const Sales = lazy(() => import('./pages/dashboard/Sales').then(m => ({ default: m.Sales })));
const SaleDetail = lazy(() => import('./pages/dashboard/Sales').then(m => ({ default: m.SaleDetail })) );

// Create Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// Simple placeholder components while we build the real ones
const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg">
    <div className="animate-pulse-glow p-4 rounded-full">
      <div className="h-12 w-12 rounded-full border-4 border-t-primary-500 border-surface-800 animate-spin"></div>
    </div>
  </div>
);

const RouteFallback = () => <LoadingScreen />;

const NotFound = () => {
  const { t } = useTranslation();
  return <div className="p-8"><h2>{t('404 - Page Not Found')}</h2></div>;
};

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// Admin Route Wrapper — super_admin and government_officer only
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!profile || (profile.role !== 'super_admin' && profile.role !== 'government_officer')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Buyer Route Wrapper — buying (cart + own orders) is buyer-only. Exporters
// use Received Orders, admins/consultants don't trade.
const BuyerRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (profile?.role !== 'buyer') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Exporter Route Wrapper — selling (listings + received orders) is
// sme_owner-only. Matches the RLS seller policies and the "admin can't see
// received orders" rule.
const SmeOwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (profile?.role !== 'sme_owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Non-buyer Route Wrapper — Market Intelligence, HS Classification and
// Compliance are exporter tools; buyers are redirected to the dashboard.
const NonBuyerRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (profile?.role === 'buyer') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Main Router App
const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />

      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Suspense fallback={<RouteFallback />}><Login /></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<RouteFallback />}><Register /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={<RouteFallback />}><ForgotPassword /></Suspense>} />
      </Route>

      {/* Protected Routes (Dashboard) */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Suspense fallback={<RouteFallback />}><DashboardHome /></Suspense>} />
        <Route path="company" element={<Suspense fallback={<RouteFallback />}><CompanyProfile /></Suspense>} />
        <Route path="intelligence" element={<NonBuyerRoute><Suspense fallback={<RouteFallback />}><MarketIntelligence /></Suspense></NonBuyerRoute>} />
        <Route path="marketplace" element={<Suspense fallback={<RouteFallback />}><Marketplace /></Suspense>} />
        <Route path="marketplace/create" element={<SmeOwnerRoute><Suspense fallback={<RouteFallback />}><CreateListing /></Suspense></SmeOwnerRoute>} />
        <Route path="marketplace/:id/edit" element={<SmeOwnerRoute><Suspense fallback={<RouteFallback />}><CreateListing /></Suspense></SmeOwnerRoute>} />
        <Route path="marketplace/:id" element={<Suspense fallback={<RouteFallback />}><MarketplaceDetail /></Suspense>} />
        <Route path="cart" element={<BuyerRoute><Suspense fallback={<RouteFallback />}><Cart /></Suspense></BuyerRoute>} />
        <Route path="cart/success" element={<BuyerRoute><Suspense fallback={<RouteFallback />}><CheckoutSuccess /></Suspense></BuyerRoute>} />
        <Route path="cart/cancel" element={<BuyerRoute><Suspense fallback={<RouteFallback />}><CheckoutCancel /></Suspense></BuyerRoute>} />
        <Route path="orders" element={<BuyerRoute><Suspense fallback={<RouteFallback />}><Orders /></Suspense></BuyerRoute>} />
        <Route path="orders/:id" element={<BuyerRoute><Suspense fallback={<RouteFallback />}><OrderDetail /></Suspense></BuyerRoute>} />
        <Route path="sales" element={<SmeOwnerRoute><Suspense fallback={<RouteFallback />}><Sales /></Suspense></SmeOwnerRoute>} />
        <Route path="sales/:id" element={<SmeOwnerRoute><Suspense fallback={<RouteFallback />}><SaleDetail /></Suspense></SmeOwnerRoute>} />
        <Route path="messages" element={<Suspense fallback={<RouteFallback />}><Messages /></Suspense>} />
        <Route path="compliance" element={<NonBuyerRoute><Suspense fallback={<RouteFallback />}><Compliance /></Suspense></NonBuyerRoute>} />
        <Route path="hs-classification" element={<NonBuyerRoute><Suspense fallback={<RouteFallback />}><HSCodeClassification /></Suspense></NonBuyerRoute>} />
        <Route path="admin/verify" element={<AdminRoute><Suspense fallback={<RouteFallback />}><VerifyCompanies /></Suspense></AdminRoute>} />
        <Route path="admin/audit" element={<AdminRoute><Suspense fallback={<RouteFallback />}><AuditLogs /></Suspense></AdminRoute>} />
        <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Mount the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ForexProvider>
                <CartProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                  <Toaster richColors position="top-right" />
                </CartProvider>
              </ForexProvider>
            </AuthProvider>
          </QueryClientProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
