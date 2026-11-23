import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { User, Globe, Moon, Sun, Monitor } from 'lucide-react';

export function Settings() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  usePageMeta('Settings');

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('settings')}</h1>
        <p className="text-text-secondary mt-1">{t('Manage your account preferences and localization.')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-500" /> {t('Account')}
            </h3>
            <p className="text-sm text-text-secondary">{t('Your personal profile information.')}</p>
        </div>
        <div className="md:col-span-2 card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary">{t('Email Address')}</label>
            <p className="text-text-primary font-medium mt-1">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">{t('Role')}</label>
            <p className="text-text-primary font-medium mt-1 capitalize">{profile?.role?.replace('_', ' ')?.replace('sme', 'SME')}</p>
          </div>
        </div>

        {/* Localization */}
        <div className="md:col-span-1 pt-4 border-t md:border-t border-border/50">
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent-500" /> {t('Language')}
            </h3>
            <p className="text-sm text-text-secondary">{t('Choose your preferred language (i18n).')}</p>
        </div>
        <div className="md:col-span-2 card p-6 pt-4 border-t md:border-t border-border/50">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setLanguage('en')}
              className={`p-4 rounded-xl border-2 transition-all text-center font-medium ${language === 'en' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-text-secondary hover:border-primary-500/50'}`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('si')}
              className={`p-4 rounded-xl border-2 transition-all text-center font-medium ${language === 'si' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-text-secondary hover:border-primary-500/50'}`}
            >
              සිංහල
            </button>
            <button
              onClick={() => setLanguage('ta')}
              className={`p-4 rounded-xl border-2 transition-all text-center font-medium ${language === 'ta' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-text-secondary hover:border-primary-500/50'}`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="md:col-span-1 pt-4 border-t md:border-t border-border/50">
            <h3 className="text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-success-500" /> {t('Appearance')}
            </h3>
            <p className="text-sm text-text-secondary">{t('Customize the UI theme.')}</p>
        </div>
        <div className="md:col-span-2 card p-6 pt-4 border-t md:border-t border-border/50">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'light' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-text-secondary hover:border-primary-500/50'}`}
            >
              <Sun className="w-6 h-6" /> {t('Light')}
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'dark' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-text-secondary hover:border-primary-500/50'}`}
            >
              <Moon className="w-6 h-6" /> {t('Dark')}
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${theme === 'system' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-text-secondary hover:border-primary-500/50'}`}
            >
              <Monitor className="w-6 h-6" /> {t('System')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
