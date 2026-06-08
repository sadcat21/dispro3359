import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Capacitor native shell
  // @ts-ignore
  if (window.Capacitor?.isNativePlatform?.()) return true;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (window.matchMedia?.('(max-width: 768px)').matches ?? false);
};

function openPdfPreview(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const overlay = document.createElement('div');
  overlay.dir = 'rtl';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.85);
    display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;gap:8px;
    padding:10px 14px;background:#0f172a;color:#fff;
  `;
  const title = document.createElement('div');
  title.textContent = filename;
  title.style.cssText = 'font-size:13px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = 'background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:4px 10px;';
  header.appendChild(title);
  header.appendChild(closeBtn);

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.style.cssText = 'flex:1;width:100%;border:0;background:#fff;';

  const footer = document.createElement('div');
  footer.style.cssText = `
    display:flex;gap:8px;padding:10px;background:#0f172a;
    box-shadow:0 -2px 8px rgba(0,0,0,.4);
  `;
  const mkBtn = (label: string, bg: string) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
      flex:1;padding:12px 8px;border:0;border-radius:10px;
      background:${bg};color:#fff;font-size:14px;font-weight:600;cursor:pointer;
    `;
    return b;
  };
  const saveBtn = mkBtn('💾 حفظ', '#16a34a');
  const printBtn = mkBtn('🖨️ طباعة', '#2563eb');
  const shareBtn = mkBtn('📤 مشاركة', '#7c3aed');

  footer.appendChild(saveBtn);
  footer.appendChild(printBtn);
  // @ts-ignore
  if (navigator.canShare || navigator.share) footer.appendChild(shareBtn);

  overlay.appendChild(header);
  overlay.appendChild(iframe);
  overlay.appendChild(footer);
  document.body.appendChild(overlay);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    overlay.remove();
  };
  closeBtn.onclick = cleanup;

  saveBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  printBtn.onclick = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
  };

  shareBtn.onclick = async () => {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      // @ts-ignore
      if (navigator.canShare?.({ files: [file] })) {
        // @ts-ignore
        await navigator.share({ files: [file], title: filename });
      } else if (navigator.share) {
        await navigator.share({ title: filename, url });
      }
    } catch (e) {
      console.warn('share failed', e);
    }
  };
}

// Wait for all images in the element to finish loading (avoids blank canvas on Android)
async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          const done = () => {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            resolve();
          };
          img.addEventListener('load', done);
          img.addEventListener('error', done);
          // safety timeout
          setTimeout(done, 4000);
        })
    )
  );
}

// Replace any computed color that html2canvas can't parse (oklch, color(), lab, lch)
// by re-applying the browser-resolved color as inline rgb() on every cloned node.
function sanitizeColorsForHtml2Canvas(orig: HTMLElement, clone: HTMLElement) {
  const origAll = [orig, ...Array.from(orig.querySelectorAll<HTMLElement>('*'))];
  const cloneAll = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
  const n = Math.min(origAll.length, cloneAll.length);
  for (let i = 0; i < n; i++) {
    const o = origAll[i];
    const c = cloneAll[i];
    if (!(c instanceof HTMLElement)) continue;
    const cs = window.getComputedStyle(o);
    // These come back as rgb()/rgba() from the browser regardless of source notation.
    c.style.color = cs.color;
    c.style.backgroundColor = cs.backgroundColor;
    c.style.borderTopColor = cs.borderTopColor;
    c.style.borderRightColor = cs.borderRightColor;
    c.style.borderBottomColor = cs.borderBottomColor;
    c.style.borderLeftColor = cs.borderLeftColor;
    const fill = cs.fill;
    const stroke = cs.stroke;
    if (fill && fill !== 'none') c.style.fill = fill;
    if (stroke && stroke !== 'none') c.style.stroke = stroke;
  }
}

export type GeneratePdfMode = 'auto' | 'save' | 'preview';

export async function generatePDF(
  element: HTMLElement,
  filename: string,
  mode: GeneratePdfMode = 'auto'
) {
  const saved: { el: HTMLElement; overflow: string; maxHeight: string; height: string; transform: string }[] = [];
  let ancestor: HTMLElement | null = element;
  while (ancestor && ancestor !== document.documentElement) {
    const s = ancestor.style;
    saved.push({ el: ancestor, overflow: s.overflow, maxHeight: s.maxHeight, height: s.height, transform: s.transform });
    s.overflow = 'visible';
    s.maxHeight = 'none';
    s.height = 'auto';
    s.transform = 'none';
    ancestor = ancestor.parentElement;
  }

  // Make sure images are decoded before snapshot.
  await waitForImages(element);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      width: element.scrollWidth,
      height: element.scrollHeight,
      onclone: (_doc, clonedEl) => {
        try {
          sanitizeColorsForHtml2Canvas(element, clonedEl as HTMLElement);
        } catch (e) {
          console.warn('[generatePDF] color sanitize failed', e);
        }
      },
    });
  } finally {
    for (const { el, overflow, maxHeight, height, transform } of saved) {
      el.style.overflow = overflow;
      el.style.maxHeight = maxHeight;
      el.style.height = height;
      el.style.transform = transform;
    }
  }

  const A4_W = 210, A4_H = 297, M = 10;
  const CW = A4_W - M * 2;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const scale = CW / canvas.width;
  const totalH = canvas.height * scale;
  const pageH = A4_H - M * 2;

  if (totalH <= pageH) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', M, M, CW, totalH);
  } else {
    const sliceHPx = pageH / scale;
    let srcY = 0, page = 0;
    while (srcY < canvas.height) {
      const h = Math.min(sliceHPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', M, M, CW, h * scale);
      srcY += h;
      page++;
    }
  }

  // Save mode: always trigger a direct download (no overlay).
  if (mode === 'save') {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  if (mode === 'preview' || isMobileDevice()) {
    const blob = pdf.output('blob');
    openPdfPreview(blob, filename);
  } else {
    pdf.save(filename);
  }
}
