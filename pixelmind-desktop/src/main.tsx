import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/variables.css'
import './styles/global.css'
import './styles/proto.css'
import './styles/desktop.css'
import './styles/canvas.css'
import './styles/topbar.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
