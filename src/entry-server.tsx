import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AppContent, AppProviders } from './app/App';

export function render(url: string) {
  const html = renderToString(
    <AppProviders>
      <StaticRouter location={url}>
        <AppContent />
      </StaticRouter>
    </AppProviders>,
  );
  return { html };
}
