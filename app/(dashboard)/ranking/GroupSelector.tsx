"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex gap-2 flex-wrap">
      {groups.map((g) => (
        <Button
          key={g.id}
          variant={g.id === selectedGroupId ? "default" : "outline"}
          size="sm"
          onClick={() => router.push(`${pathname}?group=${g.id}`)}
        >
          {g.name}
        </Button>
      ))}
    </div>
  );
}
