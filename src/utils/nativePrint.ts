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

const KEEPALIVE_ATTRIBUTE = 'data-native-print-keepalive';
const PRINTABLE_ROOT_SELECTOR = '.print-container, .print-handover';
const PREPARING_ATTRIBUTE = 'data-native-print-preparing';

const cleanupNativePrintState = () => {
  if (typeof document === 'undefined') return;

  document.body.classList.remove('native-print-active');
  document.documentElement.classList.remove('native-print-active');
  document.body.removeAttribute(PREPARING_ATTRIBUTE);

  for (const staleClone of document.querySelectorAll<HTMLElement>(`[${KEEPALIVE_ATTRIBUTE}]`)) {
    staleClone.remove();
  }
};

const forcePrintableVisibility = (root: HTMLElement) => {
  const printableRoots = [
    ...(root.matches(PRINTABLE_ROOT_SELECTOR) ? [root] : []),
    ...Array.from(root.querySelectorAll<HTMLElement>(PRINTABLE_ROOT_SELECTOR)),
  ];

  for (const node of printableRoots) {
    node.removeAttribute('hidden');
    node.hidden = false;
    node.style.setProperty('display', 'block', 'important');
    node.style.setProperty('visibility', 'visible', 'important');
    node.style.setProperty('height', 'auto', 'important');
    node.style.setProperty('overflow', 'visible', 'important');
    node.style.setProperty('opacity', '1', 'important');
  }
};

const waitForNextPaint = async () => {
  if (typeof window === 'undefined') return;

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
};

const waitForPrintableLayout = async () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  await waitForNextPaint();

  const printableRoots = Array.from(document.querySelectorAll<HTMLElement>(`[${KEEPALIVE_ATTRIBUTE}] ${PRINTABLE_ROOT_SELECTOR}`));
  for (const node of printableRoots) {
    void node.offsetHeight;
    void node.getBoundingClientRect();
  }

  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
  await waitForNextPaint();
};

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

  cleanupNativePrintState();
  document.body.setAttribute(PREPARING_ATTRIBUTE, 'true');

  const clones: HTMLElement[] = [];
  for (const id of PRINT_PORTAL_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const clone = el.cloneNode(true) as HTMLElement;
    // Strip the id from the clone so it can coexist briefly with the live node
    clone.removeAttribute('id');
    clone.setAttribute(KEEPALIVE_ATTRIBUTE, id);
    clone.style.setProperty('display', 'block', 'important');
    clone.style.setProperty('visibility', 'visible', 'important');
    clone.style.setProperty('position', 'relative', 'important');
    clone.style.setProperty('width', '100%', 'important');
    clone.style.setProperty('height', 'auto', 'important');
    clone.style.setProperty('min-height', '100vh', 'important');
    clone.style.setProperty('overflow', 'visible', 'important');
    clone.style.setProperty('opacity', '1', 'important');
    clone.style.setProperty('contain', 'none', 'important');
    forcePrintableVisibility(clone);
    document.body.appendChild(clone);
    clones.push(clone);
  }

  if (clones.length === 0) return () => {};

  document.body.classList.add('native-print-active');
  document.documentElement.classList.add('native-print-active');
  document.body.removeAttribute(PREPARING_ATTRIBUTE);

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    cleanupNativePrintState();
  };
};

const findPrintableElement = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  // Prefer visible portal with content
  for (const id of PRINT_PORTAL_IDS) {
    const el = document.getElementById(id);
    if (el && el.querySelector(PRINTABLE_ROOT_SELECTOR)) {
      const inner = el.querySelector<HTMLElement>(PRINTABLE_ROOT_SELECTOR);
      if (inner) return inner;
    }
  }
  // Fallback: any printable root in DOM
  const any = document.querySelector<HTMLElement>(PRINTABLE_ROOT_SELECTOR);
  return any;
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

    void (async () => {
      try {
        // Make printable content visible so html2canvas can capture it
        document.body.classList.add('native-print-active');
        document.documentElement.classList.add('native-print-active');
        await waitForNextPaint();

        const target = findPrintableElement();
        if (!target) {
          document.body.classList.remove('native-print-active');
          document.documentElement.classList.remove('native-print-active');
          console.warn('[NativePrint] No printable element found, falling back to native print');
          const cleanup = keepPrintPortalsAlive();
          await waitForPrintableLayout();
          try {
            await NativePrint.printCurrentPage({ jobName: document.title || 'Laser Food' });
          } catch (e) {
            console.error('[NativePrint] native print failed', e);
          }
          window.setTimeout(cleanup, 30000);
          return;
        }

        forcePrintableVisibility(target);
        await waitForPrintableLayout();

        const { generatePDF } = await import('./generatePDF');
        const filename = (document.title || 'document').replace(/[\\/:*?"<>|]+/g, '_') + '.pdf';
        await generatePDF(target, filename);
      } catch (error) {
        console.error('[NativePrint] PDF preview failed:', error);
      } finally {
        document.body.classList.remove('native-print-active');
        document.documentElement.classList.remove('native-print-active');
      }
    })();
  };
};
