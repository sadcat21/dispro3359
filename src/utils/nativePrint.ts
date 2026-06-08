import { Capacitor } from '@capacitor/core';

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
const cleanupNativePrintState = () => {
  if (typeof document === 'undefined') return;

  document.body.classList.remove('native-print-active');
  document.documentElement.classList.remove('native-print-active');

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

const keepPrintPortalsAlive = (): HTMLElement[] => {
  if (typeof document === 'undefined') return () => {};

  cleanupNativePrintState();

  const clones: HTMLElement[] = [];
  for (const id of PRINT_PORTAL_IDS) {
    const el = document.getElementById(id);
    if (!el || !el.querySelector(PRINTABLE_ROOT_SELECTOR)) continue;
    const clone = el.cloneNode(true) as HTMLElement;
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

  return clones;
};

const findPrintableElement = (roots: HTMLElement[]): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  for (const root of roots) {
    const target = root.matches(PRINTABLE_ROOT_SELECTOR)
      ? root
      : root.querySelector<HTMLElement>(PRINTABLE_ROOT_SELECTOR);
    if (target) return target;
  }

  return document.querySelector<HTMLElement>(PRINTABLE_ROOT_SELECTOR);
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

    const keepAliveRoots = keepPrintPortalsAlive();

    void (async () => {
      try {
        await waitForNextPaint();

        const target = findPrintableElement(keepAliveRoots);
        if (!target) {
          browserPrint();
          return;
        }

        forcePrintableVisibility(target);
        await waitForNextPaint();

        const { generatePDF } = await import('./generatePDF');
        const filename = `${(document.title || 'print').replace(/[\\/:*?"<>|]+/g, '_')}.pdf`;
        await generatePDF(target, filename);
      } catch (error) {
        console.error('[NativePrint] PDF preview failed:', error);
        browserPrint();
      } finally {
        cleanupNativePrintState();
      }
    })();
  };
};
