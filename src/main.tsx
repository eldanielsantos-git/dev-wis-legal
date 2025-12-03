import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[main.tsx] Root element not found!');
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  console.error('[main.tsx] Error rendering app:', error);
  rootElement.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0F0E0D; color: white; font-family: sans-serif;">
      <div style="text-align: center;">
        <h1>Erro ao carregar aplicação</h1>
        <p>Por favor, recarregue a página</p>
        <p style="color: #888; font-size: 12px;">${error}</p>
      </div>
    </div>
  `;
}
