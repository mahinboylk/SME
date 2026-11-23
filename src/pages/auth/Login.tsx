import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { insforge } from '@/lib/insforge';
import { validateEmail } from '@/lib/validation';
import { track } from '@/lib/analytics';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, refreshProfile } = useAuth();
  const { t } = useTranslation();
  usePageMeta('Log In', 'Sign in to Brooke — the global trade platform for Sri Lankan SMEs.');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null
  );

  // Safety redirect
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = t('Please enter your email address');
    } else if (!validateEmail(email)) {
      errors.email = t('Please enter a valid email address');
    }
    if (!password) {
      errors.password = t('Please enter your password');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);

    try {
      const { data: authData, error: signInError } = await insforge.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      
      track('login_success', { email });
      const user = authData?.user;
      if (user) {
        // Ensure profile exists in case they registered while email confirmation was required
          const { data: profile } = await insforge.database
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          
        if (!profile) {
          // The user signed up while email verification was required, so the
          // Register page could not create profile rows as anon. Restore the
          // role chosen at signup (handed over via localStorage) and provision
          // the matching profile table.
          let pendingRole: 'sme_owner' | 'buyer' = 'sme_owner';
          try {
            const stored = localStorage.getItem('brooke_pending_role');
            if (stored === 'buyer' || stored === 'sme_owner') pendingRole = stored;
            localStorage.removeItem('brooke_pending_role');
          } catch { /* ignore */ }

          await insforge.database.from('users').insert([{
            id: user.id,
            email: user.email,
            full_name: 'SME User',
            role: pendingRole
          }]);

          if (pendingRole === 'buyer') {
            await insforge.database.from('buyer_profiles').insert([{ user_id: user.id }]);
          } else {
            await insforge.database.from('seller_profiles').insert([{ user_id: user.id }]);
          }
        }

        await refreshProfile();
      }

      // The auth context listener will pick this up and redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      track('login_failed');
      setError(err instanceof Error ? err.message : t('Failed to sign in. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-10 text-left">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t('Welcome Back')}</h1>
        <p className="text-text-secondary">{t('Enter your credentials to access your account')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6 relative" noValidate>
        {notice && (
          <div className="p-4 bg-success-500/10 border border-success-500/20 rounded-xl flex items-start gap-3 animate-slide-in-right">
            <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
            <p className="text-sm text-success-500 flex-1">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-success-500/70 hover:text-success-500 transition-colors text-lg leading-none"
              aria-label={t('Dismiss')}
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3 animate-slide-in-right">
            <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-500">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{t('Email Address')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                required
                disabled={loading}
                className="input pl-10 py-3 bg-bg-tertiary border-border focus:bg-bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ paddingLeft: '2.5rem' }}
                placeholder={t('you@company.com')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-danger-500 pl-1 mt-1 animate-fade-in">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-text-primary">{t('Password')}</label>
              <Link to="/forgot-password" className="text-sm text-primary-500 hover:text-primary-400 font-medium transition-colors">
                {t('Forgot password?')}
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                className="input pl-10 pr-12 py-3 bg-bg-tertiary border-border focus:bg-bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ paddingLeft: '2.5rem' }}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-3.5 pl-2 flex items-center text-text-tertiary hover:text-text-secondary transition-colors"
                aria-label={showPassword ? t('Hide password') : t('Show password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-danger-500 pl-1 mt-1 animate-fade-in">{fieldErrors.password}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full py-3.5 text-base shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 relative overflow-hidden group"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span className="relative z-10 flex items-center justify-center gap-2">
                {t('Sign In')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </>
          )}
        </button>

        {loading && (
          <div className="absolute inset-0 z-10 bg-bg-secondary/70 backdrop-blur-[2px] rounded-xl flex items-center justify-center animate-fade-in pointer-events-auto">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}
      </form>

      <p className="mt-8 text-left text-sm text-text-secondary">
        {t("Don't have an account?")}{' '}
        <Link to="/register" className="text-primary-500 hover:text-primary-400 font-semibold transition-colors">
          {t('Create an account')}
        </Link>
      </p>
    </div>
  );
}
