import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate';
import { initMonitoring, onUncaughtError } from './lib/monitoring';

initMonitoring();

createRoot(document.getElementById('root')!, { onUncaughtError }).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>
);
