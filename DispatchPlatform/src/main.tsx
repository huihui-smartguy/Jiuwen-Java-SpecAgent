import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { appBasePath } from './config/appBasePath';
import { loadRuntimeConfig } from './config/runtime';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

loadRuntimeConfig().then((runtimeConfig) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={appBasePath(import.meta.env.BASE_URL)}>
          <AppShell runtimeConfig={runtimeConfig} />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
});
