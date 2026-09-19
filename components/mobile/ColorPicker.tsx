"use client";

import { useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { colorName, colorSwatch, sameColor } from "@/lib/color-name";
import { cn } from "@/lib/utils";

/**
 * Common market colours, named the way Market Associates and vendors actually describe
 * them. Value stored is the plain name (not a hex code) because the catalog
 * treats variant colour as human-readable text.
 */
export const COLOR_OPTIONS: Array<{ name: string; swatch: string }> = [
  { name: "Black", swatch: "#111111" },
  { name: "White", swatch: "#FFFFFF" },
  { name: "Grey", swatch: "#9CA3AF" },
  { name: "Cream", swatch: "#F5EAD7" },
  { name: "Brown", swatch: "#7C4A21" },
  { name: "Beige", swatch: "#D8C3A5" },
  { name: "Red", swatch: "#DC2626" },
  { name: "Wine", swatch: "#7B1E3A" },
  { name: "Orange", swatch: "#F97316" },
  { name: "Yellow", swatch: "#FFC809" },
  { name: "Gold", swatch: "#C8A24A" },
  { name: "Green", swatch: "#16A34A" },
  { name: "Olive", swatch: "#6B7A2F" },
  { name: "Teal", swatch: "#0D9488" },
  { name: "Blue", swatch: "#2563EB" },
  { name: "Navy", swatch: "#1E3A5F" },
  { name: "Sky", swatch: "#61B7E8" },
  { name: "Purple", swatch: "#7C3AED" },
  { name: "Pink", swatch: "#EC4899" },
  { name: "Silver", swatch: "#C0C5CE" },
  { name: "Multi", swatch: "linear-gradient(135deg,#DC2626,#FFC809,#16A34A,#2563EB)" },
];

export function swatchFor(value: string) {
  return colorSwatch(value);
}

/**
 * Renders a stored variant colour for display. Submissions made through this
 * picker store a name ("Black"), but older, imported or admin-entered data can
 * carry a code such as "#111111". Codes are turned into everyday names
 * (see lib/color-name.ts) so nobody sees a bare hex value.
 */
export function displayColorName(value?: string) {
  return colorName(value);
}

export function ColorPicker({
  value,
  onChange,
  disabled,
  placeholder = "Colour",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const swatch = swatchFor(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center gap-2 rounded-[10px] border border-input bg-transparent px-3 text-left text-sm transition disabled:opacity-50",
            className,
          )}
        >
          {swatch ? (
            <span
              className="size-5 shrink-0 rounded-full border border-black/10"
              style={{ background: swatch }}
            />
          ) : (
            <Palette className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("flex-1 truncate", !value && "text-muted-foreground")}>
            {value ? colorName(value) : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-3">
        <div className="grid grid-cols-4 gap-2">
          {COLOR_OPTIONS.map((option) => {
            const selected = sameColor(value, option.name);
            return (
              <button
                key={option.name}
                type="button"
                onClick={() => {
                  onChange(option.name);
                  setOpen(false);
                }}
                className="flex flex-col items-center gap-1 rounded-lg p-1.5 transition hover:bg-muted"
              >
                <span
                  className="relative grid size-9 place-items-center rounded-full border border-black/10"
                  style={{ background: option.swatch }}
                >
                  {selected && (
                    <Check
                      className="size-4"
                      style={{ color: option.name === "White" || option.name === "Cream" ? "#111" : "#fff" }}
                    />
                  )}
                </span>
                <span className="text-[11px] font-medium leading-tight">{option.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 border-t pt-3">
          <p className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
            Or type an exact colour
          </p>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="e.g. Ankara print"
            className="h-10 rounded-[10px]"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
