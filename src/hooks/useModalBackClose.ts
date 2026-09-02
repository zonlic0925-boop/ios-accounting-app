import { useEffect, useRef } from "react";

let guardSeq = 0;

/**
 * Android standalone PWA: the system back gesture/key dispatches `popstate`
 * and would exit the whole app while a modal is open. Push one history entry
 * when the modal opens so the first back press closes the modal instead.
 * Desktop browser back gets the same sensible behavior; iOS has no back UI,
 * where the extra entry is inert.
 */
export function useModalBackClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const token = ++guardSeq;
    history.pushState({ __modalOpen: token }, "");
    let closedByBack = false;
    const onPopState = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      // Dismissed through the modal's own UI: consume the guard entry so the
      // next back press doesn't land on a stale state. Skip when a newer
      // modal already pushed its own guard (its back() owns the queue now).
      if (!closedByBack && history.state?.__modalOpen === token) history.back();
    };
  }, [isOpen]);
}
