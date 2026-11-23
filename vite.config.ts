import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Read the actual backend URL from the InsForge project config
  let insforgeTarget = `https://${env.VITE_INSFORGE_PROJECT_ID}.insforge.app`;
  try {
    const projectConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '.insforge/project.json'), 'utf-8'));
    if (projectConfig.oss_host) {
      insforgeTarget = projectConfig.oss_host;
    }
  } catch {
    // fall back to env-based URL
  }

  // Security headers applied to every dev/preview response. For production, the
  // host platform (e.g. Vercel/InsForge) should emit the same headers.
  // `dev` relaxes script-src because @vitejs/plugin-react injects an inline
  // react-refresh preamble script into the served HTML during development;
  // preview serves the built bundle, which has no inline scripts, so it keeps
  // the strict policy.
  function applySecurityHeaders(res: import('node:http').ServerResponse, opts: { dev: boolean }) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        opts.dev ? "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com" : "script-src 'self' https://us-assets.i.posthog.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' ws: wss: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'security-headers',
        configureServer(server) {
          server.middlewares.use((_req, res, next) => {
            applySecurityHeaders(res, { dev: true });
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((_req, res, next) => {
            applySecurityHeaders(res, { dev: false });
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        // InsForge realtime (socket.io) must be proxied in dev because the SDK
        // connects to window.location.origin; without this the WebSocket channel
        // fails and apps silently fall back to polling.
        '/socket.io': {
          target: insforgeTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: insforgeTarget,
          changeOrigin: true,
          secure: false,
          // Keep the backend's httpOnly refresh cookie on localhost so the SDK
          // can silently refresh the session after a full page reload in dev.
          cookieDomainRewrite: '',
        },
        '/functions': {
          target: insforgeTarget,
          changeOrigin: true,
          secure: false,
        },
        '/wb-api': {
          target: 'https://api.worldbank.org',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/wb-api/, '')
        },
        '/un-api': {
          target: 'https://comtradeapi.un.org',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/un-api/, '')
        }
      }
    },
  };
});
