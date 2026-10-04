import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// B1 type-and-colour spike: dev and VITE_DESIGN_PREVIEW builds only, so production drops it.
if (import.meta.env.DEV || import.meta.env.VITE_DESIGN_PREVIEW === 'true') {
  void import('@/features/designPreview/boot')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
