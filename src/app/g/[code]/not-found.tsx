import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export default function GroupNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-12">
      <Wordmark />
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">No group with that code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Codes are six characters and never contain the letters I, L or O, or the digits 0 and 1.
          Check the one you were sent, or start a new group.
        </p>
      </div>
      <Button asChild className="self-start">
        <Link href="/">Back to the start</Link>
      </Button>
    </div>
  );
}
