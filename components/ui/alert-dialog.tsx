"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AlertDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: AlertDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onCancel();
      }}
    >
      <DialogContent className="border-[var(--product-line)] bg-[#fffefa] text-[var(--product-ink)] shadow-[var(--product-shadow)] sm:max-w-[440px]">
        <DialogHeader>
          <span className="soft-label">CONFIRM ACTION</span>
          <DialogTitle className="text-xl text-[var(--product-ink)]">{title}</DialogTitle>
          <DialogDescription className="text-[var(--product-muted)]">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>
            Keep payment
          </Button>
          <Button variant="destructive" type="button" disabled={pending} onClick={onConfirm}>
            {pending ? "Cancelling…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}