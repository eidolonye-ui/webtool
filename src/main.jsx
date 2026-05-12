import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { SovereignSyncOrchestrator } from './core/sync/sovereign_orchestrator.js';
import { SovereignConsistencyAuditor } from './core/sync/consistency_auditor.js';
 
// Initialize the Spatial-Financial Coupling Bridge
SovereignSyncOrchestrator.init();

// Initialize the Logical Consistency Guard
SovereignConsistencyAuditor.init();
 
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
