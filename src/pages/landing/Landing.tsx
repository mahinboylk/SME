import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe, ShieldCheck, Cpu, Menu, X, ChevronUp, UserPlus, Building2, Rocket } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';

export function Landing() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  usePageMeta(
    'Global Trade Intelligence for Sri Lankan SMEs',
    'AI-powered market intelligence, HS code classification, compliance tracking, and a verified B2B marketplace for Sri Lankan exporters.',
  );

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-bg flex flex-col relative">
      {/* Abstract Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary-900/20 rounded-full mix-blend-screen filter blur-[120px] animate-float" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent-900/20 rounded-full mix-blend-screen filter blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sticky Header */}
      <header className="sticky top-4 z-40 h-20 flex items-center justify-between px-8 glass-strong m-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2">
          <Globe className="w-8 h-8 text-primary-500" />
          <span className="text-2xl font-black text-text-primary tracking-tight">Brooke</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{t('Features')}</a>
          <a href="#how-it-works" className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{t('How It Works')}</a>
          <Link to="/login" className="btn btn-ghost">{t('Log In')}</Link>
          <Link to="/register" className="btn btn-primary shadow-lg shadow-primary-500/20">
            {t('Get Started')}
          </Link>
        </nav>
        <button
          type="button"
          aria-label={menuOpen ? t('Close menu') : t('Open menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 rounded-lg text-text-primary hover:bg-bg-tertiary"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="md:hidden z-30 mx-4 glass-strong rounded-2xl border border-white/5 p-4 flex flex-col gap-2 animate-fade-in-up">
          <a href="#features" onClick={() => setMenuOpen(false)} className="px-4 py-3 rounded-xl text-text-primary hover:bg-bg-tertiary transition-colors">{t('Features')}</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="px-4 py-3 rounded-xl text-text-primary hover:bg-bg-tertiary transition-colors">{t('How It Works')}</a>
          <div className="flex gap-3 pt-2 border-t border-border/50">
            <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-ghost flex-1 justify-center">{t('Log In')}</Link>
            <Link to="/register" onClick={() => setMenuOpen(false)} className="btn btn-primary flex-1 justify-center shadow-lg shadow-primary-500/20">
              {t('Get Started')}
            </Link>
          </div>
        </nav>
      )}

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center z-10">
        <div className="max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary-500/20 text-primary-500 font-medium text-sm mb-4 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            {t('Powered by Google Gemma 4')}
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-text-primary tracking-tight leading-[1.1] animate-fade-in-up delay-100">
            {t('Next-Gen')} <br className="hidden md:block" />
            <span className="gradient-text inline-block mt-2">{t('Global Trade')}</span> {t('Intelligence.')}
          </h1>

          <p className="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200">
            {t('The ultimate platform for Sri Lankan SMEs to discover markets, ensure compliance, and connect with verified international buyers.')}
          </p>

          <div className="flex flex-col items-center pt-8 animate-fade-in-up delay-300">
            <Link to="/register" className="btn btn-primary btn-lg group shadow-xl shadow-primary-500/20">
              {t('Start Exporting')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </main>

      {/* Trust Badges */}
      <section className="z-10 p-4 w-full max-w-6xl mx-auto mb-8">
        <div className="glass-strong rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-border">
          {[
            { icon: ShieldCheck, label: t('Verified companies') },
            { icon: Cpu, label: t('AI-powered insights') },
            { icon: Globe, label: t('Trilingual platform') },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-3 md:px-8 pt-4 md:pt-0 first:pt-0">
              <Icon className="w-5 h-5 text-success-500" />
              <span className="text-sm font-medium text-text-primary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="z-10 p-4 w-full max-w-6xl mx-auto mb-8 scroll-mt-24">
        <h2 className="text-3xl md:text-4xl font-bold text-text-primary text-center mb-10">
          {t('How It Works')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: UserPlus, title: t('Create Your Account'), body: t('Register in minutes with your business email.') },
            { icon: Building2, title: t('Build Your Company Profile'), body: t('Add your business details, upload your registration, and get verified.') },
            { icon: Rocket, title: t('Start Trading Globally'), body: t('List products, explore markets, and connect with verified buyers.') },
          ].map(({ icon: Icon, title, body }, idx) => (
            <div key={title} className="glass-strong rounded-2xl p-8 text-center relative group hover:border-primary-500/30 transition-colors">
              <div className="absolute top-6 right-6 text-5xl font-black text-primary-500/10 group-hover:text-primary-500/20 transition-colors">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-500 mb-5">
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features (Glass Bar) */}
      <section id="features" className="z-10 p-4 w-full max-w-6xl mx-auto mb-8 scroll-mt-24">
        <h2 className="text-3xl md:text-4xl font-bold text-text-primary text-center mb-10">
          {t('Features')}
        </h2>
        <div className="glass-strong rounded-2xl p-8 grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="flex items-center gap-4 md:px-8">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-text-primary">{t('AI Market Insights')}</h3>
              <p className="text-sm text-text-secondary">{t('Instant trade data analysis')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 md:px-8 pt-6 md:pt-0">
            <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-text-primary">{t('Smart Compliance')}</h3>
              <p className="text-sm text-text-secondary">{t('Track NTMs & regulations')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 md:px-8 pt-6 md:pt-0">
            <div className="w-12 h-12 rounded-xl bg-success-500/10 flex items-center justify-center text-success-500">
              <Globe className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-text-primary">{t('B2B Marketplace')}</h3>
              <p className="text-sm text-text-secondary">{t('Verified buyer matching')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="z-10 p-4 w-full max-w-6xl mx-auto mb-8">
        <div className="relative overflow-hidden rounded-3xl gradient-primary p-10 md:p-14 text-center text-white shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full mix-blend-overlay filter blur-[60px] transform translate-x-1/3 -translate-y-1/3" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              {t('Ready to take your business global?')}
            </h2>
            <p className="text-primary-50 text-lg">
              {t('Join Sri Lankan exporters growing with AI-driven trade intelligence.')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link to="/register" className="btn bg-white text-primary-700 hover:bg-primary-50 btn-lg shadow-lg group">
                {t('Start Exporting')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/login" className="btn text-white border border-white/30 hover:bg-white/10 btn-lg">
                {t('Log In')}
              </Link>
            </div>
            <p className="text-sm text-primary-100/80">
              {t('No setup fees. Create your account today.')}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="z-10 border-t border-border/50 bg-bg-secondary/40">
        <div className="max-w-6xl mx-auto p-8 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-6 h-6 text-primary-500" />
              <span className="text-xl font-black text-text-primary tracking-tight">Brooke</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t('The ultimate platform for Sri Lankan SMEs to discover markets, ensure compliance, and connect with verified international buyers.')}
            </p>
          </div>
          <div>
            <h3 className="font-bold text-text-primary mb-3">{t('Products')}</h3>
            <ul className="space-y-2">
              {[
                // Anonymous visitors bounce off ProtectedRoute at /login, so
                // send them to /register instead of dead-end app links.
                [t('Market Intelligence'), session ? '/dashboard/intelligence' : '/register'],
                [t('HS Code Classification'), session ? '/dashboard/hs-classification' : '/register'],
                [t('Compliance Tracking'), session ? '/dashboard/compliance' : '/register'],
                [t('B2B Marketplace'), session ? '/dashboard/marketplace' : '/register'],
              ].map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-text-primary mb-3">{t('Quick Links')}</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{t('Features')}</a></li>
              <li><a href="#how-it-works" className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{t('How It Works')}</a></li>
              <li><Link to="/login" className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{t('Log In')}</Link></li>
              <li><Link to="/register" className="text-sm text-text-secondary hover:text-primary-500 transition-colors">{t('Get Started')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/50 py-4 text-center">
          <p className="text-xs text-text-tertiary">{t('© 2026 Brooke. All rights reserved.')}</p>
        </div>
      </footer>

      {/* Scroll to Top */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollTop}
          aria-label={t('Back to top')}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center hover:bg-primary-600 transition-colors animate-fade-in-up"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}