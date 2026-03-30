import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from "./App"
import "./styles/globals.css"
import "./index.css"

const ASSET_RELOAD_KEY = "portal:asset-reload";
const ASSET_RELOAD_PARAM = "__asset_reload";

try {
  sessionStorage.removeItem(ASSET_RELOAD_KEY);

  const url = new URL(window.location.href);
  if (url.searchParams.has(ASSET_RELOAD_PARAM)) {
    url.searchParams.delete(ASSET_RELOAD_PARAM);
    window.history.replaceState({}, document.title, url.toString());
  }
} catch {
  // Ignore storage/history access issues and continue rendering.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
