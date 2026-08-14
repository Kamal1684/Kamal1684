import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, onConfirm, busy }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-dialog-cancel-btn">Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-dialog-confirm-btn" disabled={busy}
            className={destructive ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}
            onClick={onConfirm}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RejectDialog({ open, onClose, title, description, onSubmit, busy }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="reject-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Rejection reason</Label>
          <Textarea data-testid="reject-reason-input" rows={3} value={reason} placeholder="Explain why this is being rejected..." onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button data-testid="reject-dialog-cancel-btn" variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-testid="reject-dialog-submit-btn" className="bg-red-600 hover:bg-red-700" disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
