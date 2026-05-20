import { useEffect, useRef, useState } from "react";
import type { NamingOption } from "../../../app/types";

type InlineCodeSelectProps = {
  value: string;
  options: NamingOption[];
  placeholder?: string;
  menuLabel: string;
  displayMode?: "code" | "label";
  onChange: (nextValue: string) => void;
};

export function InlineCodeSelect({
  value,
  options,
  placeholder = "Wybierz",
  menuLabel,
  displayMode = "code",
  onChange,
}: InlineCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.code === value) ?? null;

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
    <div className={`inline-code-select ${open ? "open" : ""}`} ref={containerRef}>
      <button
        type="button"
        className={`inline-code-select-trigger ${selectedOption ? "" : "placeholder"}`}
        aria-label={menuLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption ? (displayMode === "label" ? selectedOption.label : selectedOption.code) : placeholder}</span>
        <span className="inline-code-select-arrow">▾</span>
      </button>

      {open ? (
        <div className="inline-code-select-menu">
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`inline-code-select-option ${option.code === value ? "active" : ""}`}
              onClick={() => {
                onChange(option.code);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
