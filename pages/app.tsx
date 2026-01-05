import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { getMyTeamContext, requireSessionOrRedirect } from "../lib/team";

type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  market: string;
  currency: string;
  order_amount: number;
  updated_at: string;
  product_id: string | null;
};

export default function AppPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = useMemo(() => role === "owner" || role === "admin" || role === "manager", [role]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const session = await requireSessionOrRedirect(router.push);
      if (!session) return;

      const ctx = await getMyTeamContext();
      setTeamId(ctx.teamId);
      setRole(ctx.role);

      const uid = session.user.id;

      const { data, error } = await supabase
        .from("orders")
        .select("id, order_no, status, market, currency, order_amount, updated_at, product_id")
        .eq("team_id", ctx.teamId)
        .eq("assigned_user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data ?? []) as any);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>我的订单</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            Team: {teamId ?? "-"} {role ? `（${role}）` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/orders/new" style={{ padding: "8px 12px", border: "1px solid #111827", borderRadius: 8, background: "#111827", color: "white" }}>
            新建订单
          </Link>
          <button onClick={onLogout} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "white" }}>
            退出
          </button>
        </div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f9fafb" }}>
          你是管理员角色。打开任意订单详情页后，可进入管理页：<code>/admin/orders/&lt;orderId&gt;</code>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading && <div>加载中...</div>}
        {err && <div style={{ color: "#b91c1c", whiteSpace: "pre-wrap" }}>{err}</div>}
        {!loading && !err && rows.length === 0 && (
          <div style={{ color: "#6b7280" }}>暂无订单。点击“新建订单”创建第一单。</div>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.6fr 0.6fr 0.6fr 1fr", gap: 0, background: "#f3f4f6", padding: 10, fontWeight: 600 }}>
              <div>订单号</div><div>状态</div><div>国家</div><div>币种</div><div>金额</div><div>更新</div>
            </div>
            {rows.map((r) => (
              <Link key={r.id} href={`/orders/${r.id}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.6fr 0.6fr 0.6fr 1fr", padding: 10, borderTop: "1px solid #e5e7eb", textDecoration: "none", color: "inherit" }}>
                <div>{r.order_no}</div>
                <div>{r.status}</div>
                <div>{r.market}</div>
                <div>{r.currency}</div>
                <div>{Number(r.order_amount).toFixed(2)}</div>
                <div style={{ color: "#6b7280" }}>{new Date(r.updated_at).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
