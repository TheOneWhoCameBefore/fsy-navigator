import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// No CSS imports needed here if using Tailwind CDN, as it's loaded in App.jsx

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);