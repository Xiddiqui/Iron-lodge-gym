'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Shield, AlertTriangle, MonitorCheck } from 'lucide-react';

interface CameraPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  /** If true, shows a note about HTTPS requirement */
  isInsecureContext?: boolean;
}

/**
 * Shown when the browser denies webcam access (NotAllowedError / NotFoundError).
 * Gives step-by-step instructions for Windows 7 browsers (Chrome / Firefox / IE).
 */
export function CameraPermissionDialog({ open, onClose, isInsecureContext }: CameraPermissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Camera Permission Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {isInsecureContext && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-xs">
              <Shield className="h-4 w-4 inline mr-1" />
              <strong>HTTPS required:</strong> Camera access only works on secure (HTTPS) connections or{' '}
              <code>localhost</code>. Ask your administrator to enable HTTPS.
            </div>
          )}

          <p className="text-muted-foreground">
            Your browser has blocked access to the camera. Follow the steps below for your browser:
          </p>

          {/* Chrome */}
          <div className="rounded-md border p-3 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4 text-blue-500" />
              Google Chrome
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs pl-1">
              <li>Click the <strong>camera / lock icon</strong> in the address bar (top-left of the URL).</li>
              <li>Set <strong>Camera</strong> to <em>Allow</em>.</li>
              <li>Click <strong>Reload</strong> / press <kbd>F5</kbd>, then try again.</li>
            </ol>
          </div>

          {/* Firefox */}
          <div className="rounded-md border p-3 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4 text-orange-500" />
              Mozilla Firefox
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs pl-1">
              <li>Click the <strong>camera icon</strong> or <strong>shield icon</strong> in the address bar.</li>
              <li>Under <em>Blocked Temporarily</em>, click <strong>Allow Camera</strong>.</li>
              <li>Reload the page (<kbd>F5</kbd>) and try again.</li>
            </ol>
          </div>

          {/* Internet Explorer / Edge Legacy */}
          <div className="rounded-md border p-3 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <MonitorCheck className="h-4 w-4 text-sky-600" />
              Internet Explorer / Edge (Legacy)
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs pl-1">
              <li>A bar appears at the <strong>bottom</strong> of the screen – click <strong>Allow</strong>.</li>
              <li>If the bar is missing, go to <em>Tools → Internet Options → Privacy</em>.</li>
              <li>Under <em>Location</em>, click <strong>Clear Sites</strong>, then reload and try again.</li>
            </ol>
          </div>

          {/* Windows 7 OS tip */}
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-blue-700 text-xs">
            <strong>Windows 7 tip:</strong> Make sure your webcam driver is installed. Go to{' '}
            <em>Control Panel → Device Manager</em> and check that your camera appears under{' '}
            <em>Imaging Devices</em> without a yellow warning icon.
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="default" size="sm">
            Got it – I'll allow access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
