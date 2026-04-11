import { useEffect } from "react";

export function useTransientBanner(message: string, clearMessage: () => void, timeoutMs = 5000) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearMessage();
    }, timeoutMs);

    function handleDismiss() {
      clearMessage();
    }

    window.addEventListener("pointerdown", handleDismiss, { once: true });
    window.addEventListener("keydown", handleDismiss, { once: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", handleDismiss);
      window.removeEventListener("keydown", handleDismiss);
    };
  }, [clearMessage, message, timeoutMs]);
}
