import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ReportProvider } from './state/report-context';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReportProvider>
      <App />
    </ReportProvider>
  </StrictMode>,
);
