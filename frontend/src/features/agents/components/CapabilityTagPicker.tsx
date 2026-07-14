import { useState, useRef, useEffect } from "react";
import { Plus, X, Search, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface OptionItem {
  id: string;
  label: string;
  subtext?: string;
}

interface CapabilityTagPickerProps {
  label: string;
  icon: ReactNode;
  items: string[];
  availableOptions: OptionItem[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  placeholder?: string;
  emptyAvailableText?: string;
}

export function CapabilityTagPicker({
  label,
  icon,
  items,
  availableOptions,
  onAdd,
  onRemove,
  placeholder = "Search capabilities...",
  emptyAvailableText = "No available options to add",
}: CapabilityTagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unselectedOptions = availableOptions.filter(
    (opt) => !items.includes(opt.id)
  );

  const filteredOptions = unselectedOptions.filter(
    (opt) =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.id.toLowerCase().includes(search.toLowerCase()) ||
      (opt.subtext && opt.subtext.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="form-field">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span className="form-field__label" style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
          {icon}
          {label} ({items.length})
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          alignItems: "center",
          padding: "8px 12px",
          minHeight: "44px",
          backgroundColor: "var(--color-bg-subtle, #f8fafc)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "8px",
        }}
      >
        {items.map((item) => {
          const matchOpt = availableOptions.find((o) => o.id === item);
          const displayLabel = matchOpt ? matchOpt.label : item;
          return (
            <span
              key={item}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 500,
                borderRadius: "16px",
                backgroundColor: "var(--color-accent-subtle, #e0f2fe)",
                color: "var(--color-accent-fg, #0369a1)",
                border: "1px solid var(--color-accent-border, #bae6fd)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
              }}
            >
              <span>{displayLabel}</span>
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${displayLabel}`}
                style={{
                  background: "none",
                  border: "none",
                  padding: "1px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  color: "inherit",
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                <X size={12} />
              </button>
            </span>
          );
        })}

        <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              setSearch("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "16px",
              backgroundColor: "#fff",
              border: "1px dashed #cbd5e1",
              color: "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0284c7";
              e.currentTarget.style.color = "#0284c7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "#475569";
            }}
          >
            <Plus size={12} />
            <span>Add</span>
            <ChevronDown size={12} />
          </button>

          {isOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                zIndex: 100,
                width: "240px",
                maxHeight: "220px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 10px",
                  borderBottom: "1px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Search size={13} color="#94a3b8" />
                <input
                  type="text"
                  placeholder={placeholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: "12px",
                    width: "100%",
                    background: "transparent",
                  }}
                />
              </div>

              <div style={{ overflowY: "auto", flex: 1, padding: "4px" }}>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onAdd(opt.id);
                        setIsOpen(false);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        width: "100%",
                        padding: "6px 10px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: "#1e293b",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <span style={{ fontWeight: 500 }}>{opt.label}</span>
                      {opt.subtext && (
                        <span style={{ fontSize: "10px", color: "#64748b" }}>{opt.subtext}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                    {emptyAvailableText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
