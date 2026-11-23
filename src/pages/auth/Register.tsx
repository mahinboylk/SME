import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, Loader2, User as UserIcon, Building, Globe, Eye, EyeOff } from 'lucide-react';
import { insforge } from '@/lib/insforge';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { validateEmail } from '@/lib/validation';
import { track } from '@/lib/analytics';
import type { UserRole } from '@/types';

export function Register() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  usePageMeta('Create Account', 'Register on Brooke to start exporting or buying from verified Sri Lankan businesses.');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'sme_owner' as UserRole,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errors: { fullName?: string; email?: string; password?: string } = {};
    if (!formData.fullName.trim()) {
      errors.fullName = t('Please enter your full name');
    }
    if (!formData.email.trim()) {
      errors.email = t('Please enter your email address');
    } else if (!validateEmail(formData.email)) {
      errors.email = t('Please enter a valid email address');
    }
    if (!formData.password) {
      errors.password = t('Please enter your password');
    } else if (formData.password.length < 8) {
      errors.password = t('Must be at least 8 characters long');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Create the user in Auth
      const { data: authData, error: signUpError } = await insforge.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;
      
      track('signup_success', { role: formData.role });
      // If email verification is required, InsForge may not return the user object immediately.
      const requiresVerification = authData?.requireEmailVerification;
      const user = authData?.user;

      if (user) {
        const { error: profileError } = await insforge.database
          .from('users')
          .insert([{
            id: user.id,
            email: formData.email,
            full_name: formData.fullName,
            role: formData.role,
          }]);

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        if (formData.role === 'sme_owner') {
          await insforge.database.from('seller_profiles').insert([{ user_id: user.id }]);
        } else if (formData.role === 'buyer') {
          await insforge.database.from('buyer_profiles').insert([{ user_id: user.id }]);
        }

        // Re-fetch the profile so the dashboard doesn't show stale data until reload
        await refreshProfile();
      }

      // Automatically sign in the user if the backend doesn't require email verification
      // Or just navigate to login if it does
      if (authData?.accessToken) {
        navigate('/dashboard', { replace: true });
      } else if (requiresVerification) {
        // Email verification required — profile rows could not be created yet
        // (the session is anonymous). Hand the chosen role to the login page,
        // which back-fills users/profiles after the first verified sign-in.
        try {
          localStorage.setItem('brooke_pending_role', formData.role);
        } catch { /* private mode — back-fill falls back to sme_owner */ }
        navigate('/login', { state: { message: 'Success! Please check your email to verify your account.' } });
      } else if (!user) {
        throw new Error("Registration failed. No user returned.");
      }
      
    } catch (err: unknown) {
      track('signup_failed');
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-10 text-left">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t('Join Brooke')}</h1>
        <p className="text-text-secondary">{t('Start your journey into global markets')}</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-6 relative" noValidate>
        {error && (
          <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3 animate-slide-in-right">
            <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-500">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className={`card card-interactive p-4 border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all-fast overflow-hidden ${formData.role === 'sme_owner' ? 'border-primary-500 bg-primary-500/5 hover:transform-none' : 'border-border'}`}>
            <input type="radio" name="role" value="sme_owner" className="sr-only" checked={formData.role === 'sme_owner'} onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})} />
            <Building className={`w-6 h-6 ${formData.role === 'sme_owner' ? 'text-primary-500' : 'text-text-tertiary'}`} />
            <span className={`text-sm font-semibold ${formData.role === 'sme_owner' ? 'text-primary-500' : 'text-text-primary'}`}>{t("I'm an Exporter")}</span>
          </label>
          <label className={`card card-interactive p-4 border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all-fast overflow-hidden ${formData.role === 'buyer' ? 'border-accent-500 bg-accent-500/5 hover:transform-none' : 'border-border'}`}>
            <input type="radio" name="role" value="buyer" className="sr-only" checked={formData.role === 'buyer'} onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})} />
            <Globe className={`w-6 h-6 ${formData.role === 'buyer' ? 'text-accent-500' : 'text-text-tertiary'}`} />
            <span className={`text-sm font-semibold ${formData.role === 'buyer' ? 'text-accent-500' : 'text-text-primary'}`}>{t("I'm a Buyer")}</span>
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{t('Full Name')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
                <UserIcon className="h-5 w-5" />
              </div>
              <input
                type="text"
                required
                disabled={loading}
                className="input pl-10 py-3 bg-bg-tertiary border-border focus:bg-bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ paddingLeft: '2.5rem' }}
                placeholder={t('John Doe')}
                value={formData.fullName}
                onChange={(e) => {
                  setFormData({...formData, fullName: e.target.value});
                  if (fieldErrors.fullName) setFieldErrors((f) => ({ ...f, fullName: undefined }));
                }}
              />
            </div>
            {fieldErrors.fullName && (
              <p className="text-xs text-danger-500 pl-1 mt-1 animate-fade-in">{fieldErrors.fullName}</p>
            )}
          </div>

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
                value={formData.email}
                onChange={(e) => {
                  setFormData({...formData, email: e.target.value});
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-danger-500 pl-1 mt-1 animate-fade-in">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">{t('Password')}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                disabled={loading}
                className="input pl-10 pr-12 py-3 bg-bg-tertiary border-border focus:bg-bg-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ paddingLeft: '2.5rem' }}
                value={formData.password}
                onChange={(e) => {
                  setFormData({...formData, password: e.target.value});
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
            {fieldErrors.password ? (
              <p className="text-xs text-danger-500 pl-1 mt-1 animate-fade-in">{fieldErrors.password}</p>
            ) : (
              <p className="text-xs text-text-tertiary pl-1 mt-1">{t('Must be at least 8 characters long')}</p>
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
                {t('Create Account')}
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
        {t('Already have an account?')}{' '}
        <Link to="/login" className="text-primary-500 hover:text-primary-400 font-semibold transition-colors">
          {t('Sign in')}
        </Link>
      </p>
    </div>
  );
}
