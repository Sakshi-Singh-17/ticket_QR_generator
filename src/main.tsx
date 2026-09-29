import React from 'react';
import ReactDOM from 'react-dom/client';
import { TicketGeneratorWorker } from './TicketGeneratorWorker';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TicketGeneratorWorker />
  </React.StrictMode>
)
