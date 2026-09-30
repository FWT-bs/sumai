import { cn } from "@/lib/utils";

/** The mark is a week of five bars with the middle three lit — the shape the
 *  app exists to find. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="flex h-5 items-end gap-[2px] rounded-[3px] bg-primary/10 px-1 py-[3px]"
      >
        <i className="block w-[3px] rounded-full bg-primary/30" style={{ height: "40%" }} />
        <i className="block w-[3px] rounded-full bg-primary" style={{ height: "100%" }} />
        <i className="block w-[3px] rounded-full bg-primary" style={{ height: "72%" }} />
        <i className="block w-[3px] rounded-full bg-primary" style={{ height: "88%" }} />
        <i className="block w-[3px] rounded-full bg-primary/30" style={{ height: "52%" }} />
      </span>
      <span className="text-[1.0625rem] font-semibold tracking-[-0.03em]">Sumai</span>
    </span>
  );
}
