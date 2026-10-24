import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AccountPage from './auth/AccountPage';
import { AuthProvider } from './auth/AuthContext';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/newsreader';
import './styles.css';

// #/account opens the account and verification page (and the Sangam team's sign-in); anything else is the app.
// The sign-in session lives in AuthProvider so the app and the account page share it.
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash.startsWith('#/account') ? (
    <div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 0' }}><a href="#/" className="link-btn">← Back to Sangam</a></div>
      <AccountPage />
    </div>
  ) : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider><Root /></AuthProvider>
  </StrictMode>,
);
