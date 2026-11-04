import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { analyticsBeforeSend } from './analytics';
import { StartupScreen } from './components/StartupScreen';

if (import.meta.env.PROD) {
  const register = () => void import('./pwa/register').then(({ registerPwa }) => registerPwa());
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

const Screen =
  location.pathname === '/lab'
    ? lazy(async () => {
        await import('./lab/lab.css');
        const { IntegrationLab } = await import('./lab/IntegrationLab');
        document.title = 'super perps · Integration lab';
        return { default: IntegrationLab };
      })
    : lazy(() => import('./app/App'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<StartupScreen />}>
      <Screen />
    </Suspense>
    {import.meta.env.PROD && import.meta.env.VITE_WEB_ANALYTICS_ENABLED === 'true' && (
      <Analytics beforeSend={analyticsBeforeSend} />
    )}
  </StrictMode>,
);
