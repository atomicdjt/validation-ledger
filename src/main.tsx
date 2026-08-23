import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { injectDemoData } from './db/demoData';
import { initializeAnalytics, privacyTelemetryBuild } from './services/analytics';
import './index.css';

const root = createRoot(document.getElementById('root')!);
document.documentElement.dataset.telemetryBuild = privacyTelemetryBuild;

async function startApplication() {
  initializeAnalytics();
  try {
    await injectDemoData();
  } catch (error) {
    console.error('Unable to initialize demo data', error);
  }

  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  );
}

void startApplication();
