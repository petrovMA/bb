import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

interface ConfirmDeleteDialogContentProps {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  pending: boolean;
  confirmDisabled?: boolean;
  size?: ButtonProps["size"];
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmDeleteDialogContent({
  title,
  description,
  children,
  confirmLabel,
  pending,
  confirmDisabled = false,
  size,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogContentProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {children}
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            data-confirm-delete-cancel
            size={size}
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size={size}
          disabled={pending || confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

interface ConfirmDeleteDialogProps {
  className?: string;
  modal?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  onOpenAutoFocus?: ComponentProps<typeof DialogContent>["onOpenAutoFocus"];
}

export function ConfirmDeleteDialog({
  className,
  modal = true,
  open,
  onOpenChange,
  children,
  onOpenAutoFocus,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent className={className} onOpenAutoFocus={onOpenAutoFocus}>
        {open ? children : null}
      </DialogContent>
    </Dialog>
  );
}
