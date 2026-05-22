import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ReceiptViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptUrls: string[];
  title?: string;
}

const ReceiptViewerDialog: React.FC<ReceiptViewerDialogProps> = ({
  open,
  onOpenChange,
  receiptUrls,
  title,
}) => {
  const { t, dir } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentUrl = receiptUrls[currentIndex] || '';

  const handleDownload = async () => {
    try {
      const response = await fetch(currentUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(currentUrl, '_blank');
    }
  };

  const handleShare = async (platform: 'whatsapp' | 'facebook' | 'telegram' | 'native') => {
    const shareText = title || t('expenses.receipt_image');
    
    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({ title: shareText, url: currentUrl });
        return;
      } catch { /* fallback */ }
    }

    const encodedUrl = encodeURIComponent(currentUrl);
    const encodedText = encodeURIComponent(shareText);

    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'noopener,noreferrer');
    }
  };

  const goNext = () => setCurrentIndex(i => Math.min(i + 1, receiptUrls.length - 1));
  const goPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));

  React.useEffect(() => {
    if (open) setCurrentIndex(0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0" dir={dir}>
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-base">
            {t('expenses.view_receipt')}
            {receiptUrls.length > 1 && ` (${currentIndex + 1}/${receiptUrls.length})`}
          </DialogTitle>
        </DialogHeader>

        {/* Image */}
        <div className="flex-1 overflow-auto px-4 flex items-center justify-center min-h-[200px] max-h-[50vh]">
          <img
            src={currentUrl}
            alt="Receipt"
            className="max-w-full max-h-[50vh] object-contain rounded-lg"
          />
        </div>

        {/* Navigation */}
        {receiptUrls.length > 1 && (
          <div className="flex items-center justify-center gap-3 py-2">
            <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIndex === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{currentIndex + 1} / {receiptUrls.length}</span>
            <Button variant="outline" size="icon" onClick={goNext} disabled={currentIndex === receiptUrls.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 pt-2 space-y-3 border-t">
          <Button variant="outline" className="w-full" onClick={handleDownload}>
            <Download className="w-4 h-4 me-2" />
            {t('expenses.download_receipt') || 'تحميل'}
          </Button>


          {navigator.share && (
            <Button variant="secondary" className="w-full" onClick={() => handleShare('native')}>
              <Share2 className="w-4 h-4 me-2" />
              {t('expenses.share') || 'مشاركة أخرى'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptViewerDialog;
