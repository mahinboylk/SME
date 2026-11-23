import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import { Global3DBackground } from '@/components/Global3DBackground';
import { ShieldCheck, Globe, LineChart, Cpu } from 'lucide-react';

export function AuthLayout() {
  const { session, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-pulse-glow p-4 rounded-full">
          <div className="h-12 w-12 rounded-full border-4 border-t-primary-500 border-surface-800 animate-spin"></div>
        </div>
      </div>
    );
  }

  // If already logged in, redirect to dashboard
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-bg flex overflow-hidden">
      <Global3DBackground />

      {/* Left Pane - Dynamic Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-[#0a1128] border-r border-border">
        {/* Deep, sophisticated abstract background */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900 via-transparent to-transparent" />
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-600 rounded-full mix-blend-screen filter blur-[150px] opacity-40 animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-600 rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-float" style={{ animationDelay: '2s' }} />
        
        {/* Noise overlay for premium texture */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
        
        <div className="relative z-10">
          <a href="/" className="inline-flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md border border-white/10 shadow-xl">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-black text-white tracking-tight">Brooke</span>
          </a>
        </div>

        <div className="relative z-10 max-w-lg mt-12">
          <h1 className="text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight animate-fade-in-up">
            {t('Elevate your')}{' '}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-300 to-primary-300">{t('Global Trade')}</span>{' '}{t('Intelligence.')}
          </h1>
          <p className="text-primary-100/80 text-lg mb-12 leading-relaxed font-medium animate-fade-in-up delay-100">
            {t('AI-powered market insights, smart compliance tracking, and seamless buyer matching for ambitious Sri Lankan SMEs.')}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
              <div className="bg-white/10 w-10 h-10 flex items-center justify-center rounded-xl">
                <LineChart className="w-5 h-5 text-accent-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{t('Market Data')}</h3>
                <p className="text-white/60 text-sm">{t('Real-time WITS analytics')}</p>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
              <div className="bg-white/10 w-10 h-10 flex items-center justify-center rounded-xl">
                <Cpu className="w-5 h-5 text-accent-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{t('AI Driven')}</h3>
                <p className="text-white/60 text-sm">{t('Powered by Gemma 4')}</p>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex flex-col gap-3 col-span-2">
              <div className="bg-white/10 w-10 h-10 flex items-center justify-center rounded-xl">
                <ShieldCheck className="w-5 h-5 text-accent-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{t('Verified Network')}</h3>
                <p className="text-white/60 text-sm">{t('Connect with trusted international buyers')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-primary-200 text-sm font-medium">
          {t('copyright_line', { year: new Date().getFullYear() })}
        </div>
      </div>

      {/* Right Pane - Form Outlet */}
      <div data-scroll-root className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-24 relative">
        <div className="absolute inset-0 bg-surface-900/50 mix-blend-multiply pointer-events-none lg:hidden" />
        <div className="w-full max-w-md relative z-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
