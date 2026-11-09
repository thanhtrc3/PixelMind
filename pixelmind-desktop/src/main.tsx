import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/variables.css'
import './styles/global.css'
import './styles/proto.css'
import './styles/desktop.css'
import './styles/canvas.css'
import './styles/topbar.css'
import './styles/sidebar.css'
import './styles/toolbox.css'
import './styles/ai.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
