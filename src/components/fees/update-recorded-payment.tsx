'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/hooks/use-role';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export type RecordedPayment = {
  id: string;
  amount: number;
  amount_paid: number;
  discount?: number | null;
};

export function UpdateRecordedPaymentButton({
  record,
  title,
}: {
  record: RecordedPayment;
  title?: string;
}) {
  const { data: role } = useRole();
  const [open, setOpen] = useState(false);

  if (role !== 'admin' || !record?.id || String(record.id).startsWith('v_')) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Pencil className="h-3 w-3" />
        Update
      </Button>
      {open && (
        <UpdateRecordedPaymentDialog
          record={record}
          title={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function UpdateRecordedPaymentDialog({
  record,
  title,
  onClose,
}: {
  record: RecordedPayment;
  title?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [feeAmount, setFeeAmount] = useState(String(Number(record.amount) || 0));
  const [amountReceived, setAmountReceived] = useState(String(Number(record.amount_paid) || 0));
  const [discount, setDiscount] = useState(String(Number(record.discount) || 0));
  const [saving, setSaving] = useState(false);

  const feeNum = Math.max(0, Number(feeAmount) || 0);
  const receivedNum = Math.max(0, Number(amountReceived) || 0);
  const discountNum = Math.max(0, Number(discount) || 0);
  const remaining = Math.max(0, feeNum - discountNum - receivedNum);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/fees/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeId: record.id,
          amount: feeNum,
          amountPaid: receivedNum,
          discount: discountNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update payment');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['all_fee_records'] }),
        queryClient.invalidateQueries({ queryKey: ['member_fees'] }),
        queryClient.invalidateQueries({ queryKey: ['members'] }),
        queryClient.invalidateQueries({ queryKey: ['dash-fees'] }),
        queryClient.invalidateQueries({ queryKey: ['dash-recent-payment-records'] }),
        queryClient.invalidateQueries({ queryKey: ['dash-trend'] }),
        queryClient.invalidateQueries({ queryKey: ['dash-active'] }),
      ]);

      toast.success(
        remaining > 0
          ? `Payment updated. ${formatCurrency(remaining)} is still due.`
          : 'Payment updated'
      );
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Update recorded payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {title && <p className="text-sm text-muted-foreground">{title}</p>}
          <p className="text-xs text-muted-foreground">
            Correct a payment that was saved with the wrong amount. If the customer paid 1000, set Amount received to 1000. Whatever is left stays due.
          </p>
          <div className="space-y-1.5">
            <Label>Fee charged (PKR)</Label>
            <Input
              type="number"
              min="0"
              value={feeAmount}
              onChange={(event) => setFeeAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount received (PKR)</Label>
            <Input
              type="number"
              min="0"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Discount (PKR)</Label>
            <Input
              type="number"
              min="0"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Still due after this update</span>
            <span className={remaining > 0 ? 'font-semibold text-red-500' : 'font-semibold text-green-600'}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
