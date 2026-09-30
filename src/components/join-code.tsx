"use client";

import * as React from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The code is the whole sharing mechanism, so it is shown at full size and
 *  both it and the link it belongs to are one tap from the clipboard. */
export function JoinCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = React.useState<"code" | "link" | null>(null);

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? code : `${window.location.origin}/g/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // Some browsers refuse the clipboard; select the code so it can be
      // copied by hand instead.
      const node = document.getElementById("join-code-value");
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  return (
    <div className={cn("flex flex-col gap-2.5 rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Join code</p>
          <p
            id="join-code-value"
            className="mt-0.5 font-mono text-2xl font-semibold tracking-[0.18em] tnum"
          >
            {code}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void copy("code")}
            aria-label="Copy the join code"
          >
            {copied === "code" ? <Check className="text-primary" /> : <Copy />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void copy("link")}
            aria-label="Copy the invite link"
          >
            {copied === "link" ? <Check className="text-primary" /> : <Link2 />}
          </Button>
        </div>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {copied === "code"
          ? "Code copied."
          : copied === "link"
            ? "Link copied."
            : "Send this to your group. Anyone with the code can join and add their classes."}
      </p>
    </div>
  );
}
