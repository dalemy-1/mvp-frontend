import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { getMyTeamContext, requireSessionOrRedirect } from "../../../lib/team";

type Order = { id: string; status: string; order_no: string; market: string; review_link: string | null; };

const FLOW: Array<{ label: string; to: any }> = [
  { label: "审核通过 (approved)", to: "approved" },
  { label: "已下单 (ordered)", to: "ordered" },
  { label: "确认下单 (order_confirmed)", to: "order_confirmed" },
  { label: "进入待留评 (review_pending)", to: "review_pending" },
  { label: "留评完成 (review_done)", to: "review_done" },
  { label: "进入待返款 (payout_pending)", to: "payout_pending" },
  { label: "已返款 (paid)", to: "paid" },
  { label: "关闭 (closed)", to: "closed" },
  { label: "取消 (canceled)", to: "canceled" },
];

export default function AdminOrderPage() {
  const router = useRouter();
  const orderId = router.query.id as string | undefined;

  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = useMemo(() => role === "owner" || role === "admin" || role === "manager", [role]);

  async function load() {
    if (!orderId) return;
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const session = await requireSessionOrRedirect(router.push);
      if (!session) return;
      setUid(session.user.id);

      const ctx = await getMyTeamContext();
      setRole(ctx.role);

      const { data, error } = await supabase
        .from("orders")
        .select("id, status, order_no, market, review_link")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      setOrder(data as any);

    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orderId]);

  async function go(toStatus: any) {
    if (!orderId || !uid) return;
    setErr(null);
    setMsg(null);
    try {
      const { data, error } = await supabase.rpc("admin_set_order_status_v2", {
        p_order_id: orderId,
        p_to_status: toStatus,
        p_actor_user_id: uid,
        p_note: `admin ui -> ${toStatus}`
      });
      if (error) throw error;
      const row = (data?.[0] ?? null) as any;
      if (!row?.ok) {
        setErr(`失败：${row?.reason ?? "unknown"}`);
      } else {
        setMsg(`成功：${row.from_status} -> ${row.to_status}`);
      }
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (err) return <div style={{ padding: 24, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{err}</div>;
  if (!order) return <div style={{ padding: 24 }}>Not found</div>;
  if (!isAdmin) return <div style={{ padding: 24, color: "#b91c1c" }}>你不是管理员角色，无法访问此页面。</div>;

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>管理员操作</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>{order.order_no} | {order.market} | 当前：{order.status}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/orders/${order.id}`} style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "white" }}>返回订单</Link>
          <Link href="/app" style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "white" }}>返回列表</Link>
        </div>
      </div>

      {msg && <div style={{ marginTop: 12, padding: 10, background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 10 }}>{msg}</div>}
      {err && <div style={{ marginTop: 12, padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, whiteSpace: "pre-wrap" }}>{err}</div>}

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>状态机按钮</div>
        <div style={{ color: "#6b7280", marginBottom: 10 }}>
          数据库会强制校验：review_done 需要（留评截图或链接），paid 需要（payouts=paid + 返款截图）。
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {FLOW.map((x) => (
            <button key={x.to} onClick={() => go(x.to)} style={{ padding: 10, borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "white" }}>
              {x.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          review_link 当前值：{order.review_link ?? "(空)"}
        </div>
      </div>
    </div>
  );
}
