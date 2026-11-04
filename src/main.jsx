import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { NetworkProvider } from '@/lib/network/store'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <NetworkProvider>
        <AppShell>
          <App />
        </AppShell>
      </NetworkProvider>
    </BrowserRouter>
  </StrictMode>,
)
