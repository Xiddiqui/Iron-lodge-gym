'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X, ZoomIn } from 'lucide-react';

export interface PhotoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null;
  title?: string;
  subtitle?: string;
}

export function PhotoPreviewDialog({
  open,
  onOpenChange,
  photoUrl,
  title = 'Photo View',
  subtitle,
}: PhotoPreviewDialogProps) {
  if (!photoUrl) return null;

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = photoUrl;
      const sanitizedTitle = (title || 'photo').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${sanitizedTitle}-fullsize.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      window.open(photoUrl, '_blank');
    }
  };

  const handleOpenTab = () => {
    const w = window.open('');
    if (w) {
      w.document.write(`<title>${title}</title><body style="margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${photoUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" /></body>`);
    } else {
      window.open(photoUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/30">
          <div className="space-y-0.5 pr-6">
            <DialogTitle className="text-base font-bold text-foreground truncate">
              {title}
            </DialogTitle>
            {subtitle && (
              <DialogDescription className="text-xs text-muted-foreground font-mono truncate">
                {subtitle}
              </DialogDescription>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5"
              onClick={handleOpenTab}
              title="Open full size in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open Tab</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5"
              onClick={handleDownload}
              title="Download full size photo"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </div>

        {/* Image Display Area */}
        <div className="relative w-full bg-black/80 dark:bg-black/90 flex items-center justify-center p-3 sm:p-6 min-h-[300px] max-h-[75vh] overflow-hidden group">
          <img
            src={photoUrl}
            alt={title || 'Fullsize Photo'}
            className="max-h-[68vh] w-auto max-w-full object-contain rounded-lg shadow-xl transition-all duration-300 group-hover:scale-[1.01]"
          />
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-muted/40 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ZoomIn className="h-3.5 w-3.5 text-primary" /> Full-resolution member photo
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
