import '@/monaco';  // Initialize the Monaco loader (must be before other imports)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './popup.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);