import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/fonts.css'
// One CSS entry point, not four. theme.css declares the layer order and pulls
// in ../styles.css and ./demo.css as `layer(legacy)` — see its header for why
// that matters (unlayered legacy rules were beating every utility). Importing
// either of them here as well would reintroduce an unlayered copy.
import './styles/theme.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
