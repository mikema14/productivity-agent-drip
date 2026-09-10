import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionEndOverlay } from './SessionEndOverlay';
import '../overlay.css';

ReactDOM.createRoot(document.getElementById('overlay-root')!).render(
  <React.StrictMode>
    <SessionEndOverlay />
  </React.StrictMode>
);
