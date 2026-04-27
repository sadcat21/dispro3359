import { createRoot } from "react-dom/client";
import RuntimeGuard from "./components/RuntimeGuard.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import App from "./App.tsx";
import "./index.css";
import { installNativePrintBridge } from "./utils/nativePrint.ts";

installNativePrintBridge();

createRoot(document.getElementById("root")!).render(
  <RuntimeGuard>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </RuntimeGuard>
);
