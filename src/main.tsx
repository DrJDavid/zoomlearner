import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './style.css'

console.log('main.tsx executing');

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      console.log('Unregistering service worker:', registration);
      registration.unregister();
    }
  });
}

// Log all script tags for debugging
console.log('All script tags:', document.querySelectorAll('script'));

const rootElement = document.getElementById('root');
console.log('Found root element:', rootElement);

if (!rootElement) {
  console.error('Root element not found!');
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
console.log('Created React root');

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

console.log('Rendered App component'); 