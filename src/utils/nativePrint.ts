import { Capacitor, registerPlugin } from '@capacitor/core';

type NativePrintPlugin = {
  printCurrentPage(options?: { jobName?: string }): Promise<{ jobId?: string }>;
};

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');

let nativePrintInstalled = false;

export const installNativePrintBridge = () => {
  if (nativePrintInstalled || typeof window === 'undefined') return;
  nativePrintInstalled = true;

  const browserPrint = window.print.bind(window);

  window.print = () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      browserPrint();
      return;
    }

    NativePrint.printCurrentPage({ jobName: document.title || 'Laser Food' }).catch((error) => {
      console.error('[NativePrint] Failed to open Android print dialog:', error);
      browserPrint();
    });
  };
};