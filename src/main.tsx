import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './components/motion/theme.css'; // Confluence Dark theme (P3) - one shared-file line, flagged in the PR
import { initSmoothScroll } from './components/motion/smooth'; // Confluence Flow (P3) - Lenis smooth scroll, flagged in the PR

initSmoothScroll();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
