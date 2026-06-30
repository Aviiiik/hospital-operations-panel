import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  /** Heading of the dialog. Defaults to "Are you sure?" */
  title?: string;
  /** Body message. Defaults to a generic confirmation prompt. */
  description?: string;
  /** Label of the confirm button. Defaults to "Yes, continue". */
  confirmText?: string;
  /** Label of the cancel button. Defaults to "Cancel". */
  cancelText?: string;
  /** Use the destructive (red) styling for the confirm button. */
  destructive?: boolean;
}

interface DialogState extends ConfirmOptions {
  open: boolean;
}

const DEFAULTS: Required<Omit<ConfirmOptions, "destructive">> = {
  title: "Are you sure?",
  description: "Please confirm you want to continue.",
  confirmText: "Yes, continue",
  cancelText: "Cancel",
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
//
// Imperative confirmation prompt. Usage:
//
//   const { confirm, ConfirmDialog } = useConfirm();
//   ...
//   const handleSave = async () => {
//     if (!(await confirm({ description: "Save this bill?" }))) return;
//     // ...proceed
//   };
//   ...
//   return (<> ...page... <ConfirmDialog /> </>);
//
export function useConfirm() {
  const [state, setState] = useState<DialogState>({ open: false });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions = {}) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const ConfirmDialog = useCallback(() => {
    const title = state.title ?? DEFAULTS.title;
    const description = state.description ?? DEFAULTS.description;
    const confirmText = state.confirmText ?? DEFAULTS.confirmText;
    const cancelText = state.cancelText ?? DEFAULTS.cancelText;

    return (
      <Dialog open={state.open} onOpenChange={(o) => { if (!o) settle(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {cancelText}
            </Button>
            <Button
              variant={state.destructive ? "destructive" : "default"}
              className={state.destructive ? undefined : "bg-blue-600 hover:bg-blue-700 text-white"}
              onClick={() => settle(true)}
            >
              {confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [state, settle]);

  return { confirm, ConfirmDialog };
}

export default useConfirm;
