"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/session";

type Choice = "light" | "dark" | "system";

const ORDER: Choice[] = ["system", "light", "dark"];
const LABEL: Record<Choice, string> = {
  system: "Match the system theme",
  light: "Light theme",
  dark: "Dark theme",
};

/** The inline script in the layout has already applied any stored choice to
 *  the root element, so the DOM is the source of truth once hydrated. */
function currentChoice(): Choice {
  const applied = document.documentElement.dataset.theme;
  return applied === "dark" || applied === "light" ? applied : "system";
}

export function ThemeToggle() {
  const hydrated = useHydrated();
  const [choice, setChoice] = React.useState<Choice>("system");

  const applied = hydrated ? (choice === "system" ? currentChoice() : choice) : "system";

  const advance = () => {
    const next = ORDER[(ORDER.indexOf(applied) + 1) % ORDER.length];
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "system") window.localStorage.removeItem("sumai.theme");
      else window.localStorage.setItem("sumai.theme", next);
    } catch {
      /* The choice still applies for this visit. */
    }
  };

  const Icon = applied === "dark" ? Moon : applied === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={advance}
      aria-label={LABEL[applied]}
      title={LABEL[applied]}
      className="text-muted-foreground"
    >
      <Icon />
    </Button>
  );
}
