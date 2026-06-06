import { Capacitor, registerPlugin } from '@capacitor/core';

type NativePrintPlugin = {
  printCurrentPage(options?: { jobName?: string }): Promise<{ jobId?: string }>;
};

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');

let nativePrintInstalled = false;

// IDs of portals that hold printable content (must match @media print CSS in index.css)
const PRINT_PORTAL_IDS = [
  'print-portal',
  'gifts-print-portal',
  'loadsheet-print-portal',
  'print-portal-promo-details',
  'session-print-portal',
];

/**
 * On native Android the print dialog opens asynchronously, but most callers
 * unmount the React print component immediately after calling window.print().
 * That removes the print portal before Android's WebView snapshots the page,
 * producing a blank print preview. To fix it we deep-clone the current portal
 * nodes into detached keep-alive copies that survive React unmount, and
 * remove them after the print job has had time to render.
 */
const keepPrintPortalsAlive = (): (() => void) => {
  if (typeof document === 'undefined') return () => {};

  const clones: HTMLElement[] = [];
  for (const id of PRINT_PORTAL_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const clone = el.cloneNode(true) as HTMLElement;
    // Strip the id from the clone so it can coexist briefly with the live node
    clone.removeAttribute('id');
    clone.setAttribute('data-native-print-keepalive', id);
    document.body.appendChild(clone);
    clones.push(clone);
  }

  if (clones.length === 0) return () => {};

  document.body.classList.add('native-print-active');

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove('native-print-active');
    for (const c of clones) {
      if (c.parentNode) c.parentNode.removeChild(c);
    }
  };
};

export const installNativePrintBridge = () => {
  if (nativePrintInstalled || typeof window === 'undefined') return;
  nativePrintInstalled = true;

  const browserPrint = window.print.bind(window);

  window.print = () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      browserPrint();
      return;
    }

    const cleanup = keepPrintPortalsAlive();

    NativePrint.printCurrentPage({ jobName: document.title || 'Laser Food' })
      .catch((error) => {
        console.error('[NativePrint] Failed to open Android print dialog:', error);
        cleanup();
        browserPrint();
      })
      .finally(() => {
        // Give Android's print framework enough time to render the WebView to
        // PDF before we drop the keep-alive snapshot. The print dialog itself
        // is shown by the OS; rendering happens shortly after.
        window.setTimeout(cleanup, 30000);
      });
  };
};
