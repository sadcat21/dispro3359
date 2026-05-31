import { createRoot } from "react-dom/client";
import RuntimeGuard from "./components/RuntimeGuard.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import App from "./App.tsx";
import "./index.css";
import { installNativePrintBridge } from "./utils/nativePrint.ts";

installNativePrintBridge();

// Auto-recover from stale chunk hashes after a new deploy
const handleChunkLoadFailure = (msg: string) => {
  if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
    const key = "__chunk_reload_at";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 10_000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  }
};
window.addEventListener("error", (e) => handleChunkLoadFailure(e.message || ""));
window.addEventListener("unhandledrejection", (e) => handleChunkLoadFailure(String(e.reason?.message || e.reason || "")));

createRoot(document.getElementById("root")!).render(
  <RuntimeGuard>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </RuntimeGuard>
);
