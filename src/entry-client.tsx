import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { AppContent, AppProviders } from './app/App';
import './styles/index.css';

document.title = "Korte.ph - Philippines' No. 1 Court Booking App";
document.documentElement.style.minWidth = '360px';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const app = (
  <AppProviders>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </AppProviders>
);

if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
