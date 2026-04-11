import { useEffect, useRef, useState } from "react";

type HeroMenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

type HeroMenuProps = {
  expandedAriaLabel: string;
  collapsedAriaLabel: string;
  items: HeroMenuItem[];
};

type FilterHeroMenuProps = {
  canExportReport: boolean;
  exportLabel: string;
  onChooseRoot: () => void;
  onExportReport: () => void;
};

type DecodingHeroMenuProps = {
  dictionaryPath: string;
  onEditDictionary: () => void;
  onRefreshDictionary: () => void;
  onManageTemplates: () => void;
};

type NamingHeroMenuProps = {
  canRefreshWorkingFolder: boolean;
  refreshWorkingFolderLabel: string;
  canUndoLastOperation: boolean;
  onRefreshWorkingFolder: () => void;
  onUndoLastOperation: () => void;
};

function HeroMenu({ expandedAriaLabel, collapsedAriaLabel, items }: HeroMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className={`filter-hero-menu ${open ? "open" : ""}`} ref={menuRef}>
      <button
        type="button"
        className="filter-hero-menu-trigger"
        aria-label={open ? expandedAriaLabel : collapsedAriaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      {open ? (
        <div className="filter-hero-menu-popover">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="filter-hero-menu-item"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FilterHeroMenu({
  canExportReport,
  exportLabel,
  onChooseRoot,
  onExportReport,
}: FilterHeroMenuProps) {
  return (
    <HeroMenu
      expandedAriaLabel="Zwiń menu filtra"
      collapsedAriaLabel="Rozwiń menu filtra"
      items={[
        { label: "Wybierz folder źródłowy", onSelect: onChooseRoot },
        { label: exportLabel, onSelect: onExportReport, disabled: !canExportReport },
      ]}
    />
  );
}

export function DecodingHeroMenu({
  dictionaryPath,
  onEditDictionary,
  onRefreshDictionary,
  onManageTemplates,
}: DecodingHeroMenuProps) {
  return (
    <HeroMenu
      expandedAriaLabel="Zwiń menu odkodowania"
      collapsedAriaLabel="Rozwiń menu odkodowania"
      items={[
        { label: "Edytuj słownik", onSelect: onEditDictionary, disabled: !dictionaryPath },
        { label: "Odśwież słownik", onSelect: onRefreshDictionary },
        { label: "Menedżer szablonów", onSelect: onManageTemplates },
      ]}
    />
  );
}

export function NamingHeroMenu({
  canRefreshWorkingFolder,
  refreshWorkingFolderLabel,
  canUndoLastOperation,
  onRefreshWorkingFolder,
  onUndoLastOperation,
}: NamingHeroMenuProps) {
  return (
    <HeroMenu
      expandedAriaLabel="Zwiń menu nazewnictwa"
      collapsedAriaLabel="Rozwiń menu nazewnictwa"
      items={[
        {
          label: refreshWorkingFolderLabel,
          onSelect: onRefreshWorkingFolder,
          disabled: !canRefreshWorkingFolder,
        },
        {
          label: "Cofnij ostatnią operację",
          onSelect: onUndoLastOperation,
          disabled: !canUndoLastOperation,
        },
      ]}
    />
  );
}
