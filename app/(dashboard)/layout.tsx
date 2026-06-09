export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("group_members")
      .select("group_id")
      .eq("email", user.email!)
      .limit(1)
      .maybeSingle(),
  ]);

  const initials = (profile?.display_name ?? user.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const header = (
    <header className="border-b">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-lg">⚽ Bolão 2026</span>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm hidden sm:block">{profile?.display_name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );

  if (!membership) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-16 space-y-2">
            <p className="text-lg font-medium">Você não está em nenhum bolão.</p>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o administrador.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-lg">⚽ Bolão 2026</span>
            <nav className="flex items-center gap-4">
              <Link
                href="/palpites"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Palpites
              </Link>
              <Link
                href="/ranking"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Ranking
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm hidden sm:block">{profile?.display_name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
