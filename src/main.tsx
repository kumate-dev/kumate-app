import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { Toast } from '@/components/ui/toast';

try {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored ? stored === 'dark' : prefersDark;
  const docEl = document.documentElement;
  if (isDark) docEl.classList.add('dark');
  else docEl.classList.remove('dark');
} catch {}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Root element not found. Ensure index.html has <div id='root'></div>");
}

ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toast />
    </BrowserRouter>
  </React.StrictMode>
);
