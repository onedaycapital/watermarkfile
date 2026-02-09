import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { init as initAnalytics } from './lib/analytics'
import { ErrorBoundary } from './ErrorBoundary'
import App from './App'
import { PrivacyPolicy } from './views/PrivacyPolicy'
import { TermsOfUse } from './views/TermsOfUse'
import './index.css'

try {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => { initAnalytics() }, { timeout: 2000 })
  } else {
    setTimeout(() => { initAnalytics() }, 0)
  }
} catch {
  // ignore
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Root element missing.</p>'
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-use" element={<TermsOfUse />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    rootEl.innerHTML = `<div style="padding:24px;font-family:system-ui;max-width:600px;margin:40px auto;background:#fef2f2;border:1px solid #fecaca;border-radius:8px"><h1 style="margin:0 0 12px;font-size:18px;color:#b91c1c">Load error</h1><pre style="margin:0;font-size:12px;overflow:auto;color:#991b1b;white-space:pre-wrap">${msg}</pre></div>`
    console.error('WatermarkFile bootstrap error:', err)
  }
}
