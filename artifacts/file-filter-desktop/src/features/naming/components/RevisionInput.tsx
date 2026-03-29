import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useState } from "react";
import {
  getRevisionValidationMessage,
  isRevisionPartialInputAllowed,
  normalizeRevisionInput,
} from "../domain";

type RevisionInputProps = {
  id?: string;
  value: string;
  placeholder?: string;
  ariaLabel: string;
  onCommit: (nextValue: string) => void;
  onInvalid: (message: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  clearSignal?: number;
};

export function RevisionInput({
  id,
  value,
  placeholder = "Np. R21 lub W03",
  ariaLabel,
  onCommit,
  onInvalid,
  inputRef,
  clearSignal = 0,
}: RevisionInputProps) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (clearSignal > 0) {
      setDraftValue("");
    }
  }, [clearSignal]);

  function commitDraft() {
    const normalizedRevision = normalizeRevisionInput(draftValue);

    if (!draftValue.trim()) {
      onCommit("");
      return;
    }

    if (!normalizedRevision) {
      onInvalid(getRevisionValidationMessage(draftValue));
      return;
    }

    setDraftValue(normalizedRevision);
    onCommit(normalizedRevision);
  }

  function handleChange(nextValue: string) {
    const normalizedValue = nextValue.toUpperCase();

    if (!isRevisionPartialInputAllowed(normalizedValue) && !normalizeRevisionInput(normalizedValue)) {
      onInvalid(getRevisionValidationMessage(normalizedValue));
      return;
    }

    setDraftValue(normalizedValue);
  }

  return (
    <input
      id={id}
      ref={inputRef}
      value={draftValue}
      className="revision-input"
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => setDraftValue(value)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitDraft();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setDraftValue(value);
        }
      }}
    />
  );
}

export type { RevisionInputProps };
