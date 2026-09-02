import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { captureInstallPrompt } from './lib/installPrompt'
import App from './App.tsx'

// Register before first paint so the install event is never missed.
captureInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
