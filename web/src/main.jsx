import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createDemoSession } from './api';
import './styles.css';
import './ui/theme.css';

const SESSION_KEY = 'mindcode_session_id'; // same key App.jsx restores from

/**
 * `/?demo=1` loads a fresh copy of the recorded real-Opus demo session (map, approvals,
 * working build, checkpoints) so a live demo never waits on a build. The param is removed
 * afterwards, so a reload keeps the same session.
 */
async function prepareDemo() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('demo') !== '1') return;
  try {
    const s = await createDemoSession();
    localStorage.setItem(SESSION_KEY, s.id);
  } catch (e) {
    console.warn('Could not load the demo session; starting normally', e);
  }
  url.searchParams.delete('demo');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

prepareDemo().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
