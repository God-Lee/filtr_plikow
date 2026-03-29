import { useEffect, useRef, useState } from "react";
import {
  REVISION_CUSTOM_OPTION_LABEL,
  REVISION_PRESET_OPTIONS,
} from "../domain";
import { RevisionInput, type RevisionInputProps } from "./RevisionInput";

type RevisionPresetInputProps = RevisionInputProps & {
  menuLabel: string;
};

export function RevisionPresetInput(props: RevisionPresetInputProps) {
  const [open, setOpen] = useState(false);
  const [clearSignal, setClearSignal] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className={`revision-picker ${open ? "open" : ""}`} ref={containerRef}>
      <RevisionInput {...props} clearSignal={clearSignal} />
      <button
        type="button"
        className="revision-picker-toggle"
        aria-label={props.menuLabel}
        onClick={() => setOpen((current) => !current)}
      >
        ▾
      </button>

      {open ? (
        <div className="revision-picker-menu">
          {REVISION_PRESET_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              className="revision-picker-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                props.onCommit(option.code);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className="revision-picker-option"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setClearSignal((current) => current + 1);
              setOpen(false);
              window.setTimeout(() => props.inputRef?.current?.focus(), 0);
            }}
          >
            {REVISION_CUSTOM_OPTION_LABEL}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type { RevisionPresetInputProps };
