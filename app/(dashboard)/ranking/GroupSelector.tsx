"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toSlug } from "./group-slug";

interface Group {
  id: string;
  name: string;
}

interface GroupSelectorProps {
  groups: Group[];
  selectedGroupId: string;
}

export function GroupSelector({ groups, selectedGroupId }: GroupSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  return (
    <div className="flex gap-2 flex-wrap">
      {groups.map((g) => (
        <Button
          key={g.id}
          variant={g.id === selectedGroupId ? "default" : "outline"}
          size="sm"
          disabled={isPending}
          onClick={() => {
            setPendingGroupId(g.id);
            startTransition(() => router.push(`${pathname}?group=${toSlug(g.name)}`));
          }}
        >
          {isPending && pendingGroupId === g.id ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            g.name
          )}
        </Button>
      ))}
    </div>
  );
}
