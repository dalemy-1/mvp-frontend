import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { getMyTeamContext, requireSessionOrRedirect } from "../../../lib/team";

type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  market: string;
  currency: string;
  order_amount: number;
  discount: number;
  assigned_user_id: string | null;
  updated_at: string;
};

const STATUS_OPTIONS = [
  "submitted",
  "approved",
  "ordered",
  "order_confirmed",
  "review_pending",
  "review_done",
  "payout_pending",
  "paid",
  "closed",
  "canceled",
];

const MARKET_OPTIONS = ["US", "UK", "DE", "FR", "IT", "ES", "CA", "JP"];

export default function AdminOrdersListPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [market, setMarket] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const isAdmin = useMemo(() => role === "owner" || role === "admin" || role === "manager", [role]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const session = await requireSessionOrRedirect(router.push);
      if (!session) return;

      const ctx = await getMyTeamContext();
      setRole(ctx.role);
      setTeamId(ctx.teamId);

      if (!(ctx.role === "owner" || ctx.role === "admin" || ctx.role === "manager")) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Base query (admin can read all team orders if RLS patch applied)
      let query = supabase
        .from("orders")
        .select("id, order_no, status, market, currency, order_amount, discount, assigned_user_id, updated_at")
        .eq("team_id", ctx.teamId);

      if (status) query = query.eq("status", status);
      if (market) query = query.eq("market", market);
      if (q.trim()) query = query.ilike("order_no", `%${q.trim()}%`);

      // simple pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await query.order("updated_at", { ascending: false }).range(from, to);

      if (error) throw error;
      setRows((data ?? []) as any);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function onApplyFilters() {
    setPage(1);
    load();
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>管理员订单列表</h1>
        <div style={{ marginTop: 10, color: "#b91c1c" }}>你不是管理员角色，无法访问此页面。</div>
        <div style={{ marginTop: 12 }}>
          <Link href="/app">返回我的订单</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>管理员订单列表</h1>
          <div style={{ color: "#6b7280", marginTop: 6 }}>Team: {teamId ?? "-"}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/app" style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "white" }}>
            返回我的订单
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>状态</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }}>
              <option value="">全部</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>国家/市场</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)} style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }}>
              <option value="">全部</option>
              {MARKET_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>搜索订单号</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入订单号片段"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
          </label>

          <button onClick={onApplyFilters} style={{ height: 42, alignSelf: "end", padding: "0 14px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "white" }}>
            应用
          </button>
        </div>

        {err && <div style={{ marginTop: 10, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{err}</div>}
      </div>

      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.5fr 0.5fr 0.6fr 0.9fr 0.8fr", padding: 10, background: "#f3f4f6", fontWeight: 700 }}>
          <div>订单号</div>
          <div>状态</div>
          <div>市场</div>
          <div>币种</div>
          <div>金额</div>
          <div>assigned_user</div>
          <div>更新</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 12, color: "#6b7280" }}>暂无数据</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.5fr 0.5fr 0.6fr 0.9fr 0.8fr", padding: 10, borderTop: "1px solid #e5e7eb", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 600 }}>{r.order_no}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/admin/orders/${r.id}`} style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #111827", borderRadius: 999, background: "#111827", color: "white", textDecoration: "none" }}>
                    管理
                  </Link>
                  <Link href={`/orders/${r.id}`} style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 999, background: "white", textDecoration: "none", color: "#111827" }}>
                    详情
                  </Link>
                </div>
              </div>
              <div>{r.status}</div>
              <div>{r.market}</div>
              <div>{r.currency}</div>
              <div>{Number(r.order_amount).toFixed(2)}</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#374151" }}>{r.assigned_user_id ?? "-"}</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>{new Date(r.updated_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", opacity: page === 1 ? 0.5 : 1 }}
        >
          上一页
        </button>
        <div style={{ color: "#6b7280" }}>第 {page} 页（每页 {pageSize} 条）</div>
        <button
          onClick={() => setPage((p) => p + 1)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
