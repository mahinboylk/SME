/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INSFORGE_PROJECT_ID: string;
  readonly VITE_INSFORGE_ANON_KEY: string;
  readonly VITE_GOOGLE_AI_API_KEY: string;
  readonly VITE_GOOGLE_AI_MODEL: string;
  readonly VITE_WTO_API_KEY: string;
  readonly VITE_WTO_API_BASE_URL: string;
  readonly VITE_WITS_BASE_URL: string;
  readonly VITE_ITC_INTEGRATION_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
