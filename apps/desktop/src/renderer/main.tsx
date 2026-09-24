import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import WindowTitleBar from './components/WindowTitleBar';
import HostLockOverlay from './components/HostLockOverlay';
import { applyCustomizationPreferences, readCustomizationPreferences } from './lib/customizationPreferences';
import './index.css';

// Apply the persisted theme and font scale before the first paint so the
// login screen and app start in the user's chosen mode (no light flash).
const bootPrefs = readCustomizationPreferences();
applyCustomizationPreferences({ darkMode: bootPrefs.darkMode, fontSize: bootPrefs.fontSize });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WindowTitleBar />
    <App />
    {/* Full-window lock over the whole app (title bar included) while this
        machine is being controlled remotely. Auto-hides when the session ends. */}
    <HostLockOverlay />
  </React.StrictMode>
);
