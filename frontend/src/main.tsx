import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// CSS импортируется в main.tsx — загружается первым, до любых компонентов.
// Порядок важен: сначала legacy стили (как в vanilla), потом наши токены (могут переопределить).
import './styles/app.css';
import './styles/tokens.css';
import './styles/react-additions.css';

import { AppProviders } from './app/providers';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>
);
