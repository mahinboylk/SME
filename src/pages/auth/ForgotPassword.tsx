import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { insforge } from '@/lib/insforge';
import { useTranslation } from '@/contexts/I18nContext';
import { validateEmail } from '@/lib/validation';
import { track } from '@/lib/analytics';
import { usePageMeta } from '@/hooks/usePageMeta';

export function ForgotPassword() {
  const { t } = useTranslation();
  usePageMeta('Reset Password');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});
  const [sent, setSent] = useState(false);

  const validate = (): boolean => {
    const errors: { email?: string } = {};
    if (!email.trim()) {
      errors.email = t('Please enter your email address');
    } else if (!validateEmail(email)) {
      errors.email = t('Please enter a valid email address');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);

    try {
      const { error: resetError } = await insforge.auth.sendResetPasswordEmail({ email });
      if (resetError) throw resetError;
      track('password_reset_requested');
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to send password reset email.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-10 text-left">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{t('Reset Password')}</h1>
        <p className="text-text-secondary">{t('Enter your email and we will send you a reset link.')}</p>
      </div>

      {sent ? (
        <div className="p-4 bg-success-500/10 border border-success-500/20 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
          <p className="text-sm text-success-500">
            {t('If an account exists for that email, a password reset link has been sent.')}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {error && (
            <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-start gap-3 animate-slide-in-right">
              <AlertCircle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-500">{error}</p>
            </div>
          )}

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

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3.5 text-base shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('Send Reset Link')
            )}
          </button>
        </form>
      )}

      <p className="mt-8 text-left text-sm text-text-secondary">
        <Link to="/login" className="inline-flex items-center gap-1 text-primary-500 hover:text-primary-400 font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('Back to Sign In')}
        </Link>
      </p>
    </div>
  );
}