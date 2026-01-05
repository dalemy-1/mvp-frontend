import { supabase } from "./supabaseClient";

/**
 * Require a valid session; if missing, redirect to /login.
 */
export async function requireSessionOrRedirect(push: (url: string) => any) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    await push("/login");
    return null;
  }
  return data.session;
}

/**
 * Get current user's single active team + role.
 * Assumption (方案A): one user belongs to one active team.
 *
 * This function intentionally queries team_members by user_id directly,
 * to avoid relying on any Postgres helper/RLS side effects.
 */
export async function getMyTeamContext(): Promise<{ teamId: string; role: string }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, role, is_active")
    .eq("user_id", uid)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.team_id) throw new Error("no_active_team_membership");
  if (!data.role) throw new Error("no_role_in_team_membership");

  return { teamId: data.team_id, role: data.role };
}
