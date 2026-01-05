import { supabase } from "./supabaseClient";

export type TeamContext = {
  teamId: string;
  role: "owner" | "admin" | "manager" | "member" | "viewer";
};

export async function getMyTeamContext(): Promise<TeamContext> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("NOT_AUTHENTICATED");

  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, is_active")
    .eq("user_id", uid)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.team_id) throw new Error("NO_TEAM_MEMBERSHIP");

  return { teamId: data.team_id, role: data.role };
}

export async function requireSessionOrRedirect(routerPush: (path: string) => void) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    routerPush("/login");
    return null;
  }
  return data.session;
}
