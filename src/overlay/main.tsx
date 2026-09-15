import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionEndOverlay } from './SessionEndOverlay';
import { EdgeGlow } from './EdgeGlow';
import '../overlay.css';

// One HTML entry serves two windows: the session-end card, and the top-edge
// attention strip (?edge=1) shown when a finished session is ignored.
const isEdge = new URLSearchParams(window.location.search).get('edge') === '1';

ReactDOM.createRoot(document.getElementById('overlay-root')!).render(
  <React.StrictMode>{isEdge ? <EdgeGlow /> : <SessionEndOverlay />}</React.StrictMode>
);
