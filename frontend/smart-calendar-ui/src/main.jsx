import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator && !window.desktopApp && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    let reloadingForUpdate = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate) return
      reloadingForUpdate = true
      window.location.reload()
    })

    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`)
      .then((registration) => {
        const checkForUpdates = () => {
          if (navigator.onLine) registration.update().catch((error) => console.error('Could not check for app updates:', error))
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdates()
        })
      })
      .catch((error) => console.error('Could not register offline app support:', error))
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
