import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AccountPage from './auth/AccountPage';
import { AuthProvider } from './auth/AuthContext';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/newsreader';
import './styles.css';

// #/account opens the sign-in and verification page until the app header links to it
const account = window.location.hash.startsWith('#/account');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {account ? <AuthProvider><AccountPage /></AuthProvider> : <App />}
  </StrictMode>,
);
