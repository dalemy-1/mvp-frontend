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
  product_id: string | null;
  updated_at: string;
  product?: { name: string; market: string } | null;
};

type ProductRow = { id: string; name: string; market: string; is_active: boolean };
type MemberRow = { user_id: string; role: string; is_active: boolean };

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
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [status, setStatus] = useState<string>("");
  const [market, setMarket] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [q, setQ] = useState<string>("");

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // bulk
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkNote, setBulkNote] = useState<string>("ok");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkLog, setBulkLog] = useState<string>("");

  const isAdmin = useMemo(() => role === "owner" || role === "admin" || role === "manager", [role]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allCheckedOnPage = useMemo(() => rows.length > 0 && rows.every((r) => selected[r.id]), [rows, selected]);

  function setAllOnPage(checked: boolean) {
    const next = { ...selected };
    for (const r of rows) next[r.id] = checked;
    setSelected(next);
  }

  async function loadSupporting(ctxTeamId: string) {
    // products
    const { data: pData, error: pErr } = await supabase
      .from("products")
      .select("id,name,market,is_active")
      .eq("team_id", ctxTeamId)
      .order("market", { ascending: true })
      .order("name", { ascending: true });
    if (!pErr) setProducts((pData ?? []) as any);

    // members (requires RLS admin select policy)
    const { data: mData, error: mErr } = await supabase
      .from("team_members")
      .select("user_id,role,is_active")
      .eq("team_id", ctxTeamId)
      .eq("is_active", true)
      .order("role", { ascending: true });
    if (!mErr) setMembers((mData ?? []) as any);
  }

  async function loadOrders(targetPage = page) {
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

      await loadSupporting(ctx.teamId);

      let query = supabase
        .from("orders")
        .select("id, order_no, status, market, currency, order_amount, discount, assigned_user_id, product_id, updated_at, product:products(name,market)")
        .eq("team_id", ctx.teamId);

      if (status) query = query.eq("status", status);
      if (market) query = query.eq("market", market);
      if (productId) query = query.eq("product_id", productId);
      if (assignee) query = query.eq("assigned_user_id", assignee);
      if (q.trim()) query = query.ilike("order_no", `%${q.trim()}%`);

      const from = (targetPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await query.order("updated_at", { ascending: false }).range(from, to);
      if (error) throw error;

      const list = (data ?? []) as any as OrderRow[];
      setRows(list);

      // keep selection but ensure keys exist
      setSelected((prev) => {
        const next = { ...prev };
        for (const r of list) if (next[r.id] === undefined) next[r.id] = false;
        return next;
      });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function onApplyFilters() {
    setPage(1);
    loadOrders(1);
  }

  function clearSelection() {
    const next = { ...selected };
    for (const k of Object.keys(next)) next[k] = false;
    setSelected(next);
  }

  async function runBulk() {
    if (!bulkStatus) {
      setBulkLog("请选择要批量设置的状态。");
      return;
    }
    if (selectedIds.length === 0) {
      setBulkLog("请先勾选要批量处理的订单。");
      return;
    }

    setBulkRunning(true);
    setBulkLog("");

    const ok: string[] = [];
    const fail: { id: string; reason: string }[] = [];

    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      setBulkLog((prev) => prev + `\n[${i + 1}/${selectedIds.length}] ${id} -> ${bulkStatus} ...`);

      try {
        const { data, error } = await supabase.rpc("admin_set_order_status_v2", {
          p_order_id: id,
          p_to_status: bulkStatus,
          p_note: bulkNote || "ok",
        });
        if (error) {
          fail.push({ id, reason: error.message });
          setBulkLog((prev) => prev + ` FAIL: ${error.message}`);
          continue;
        }
        const result = Array.isArray(data) ? data[0] : data;
        if (result?.ok) {
          ok.push(id);
          setBulkLog((prev) => prev + " OK");
        } else {
          fail.push({ id, reason: result?.reason ?? "unknown" });
          setBulkLog((prev) => prev + ` FAIL: ${result?.reason ?? "unknown"}`);
        }
      } catch (e: any) {
        fail.push({ id, reason: e?.message ?? String(e) });
        setBulkLog((prev) => prev + ` FAIL: ${e?.message ?? String(e)}`);
      }
    }

    setBulkLog((prev) =>
      prev +
      `\n\n完成：成功 ${ok.length}，失败 ${fail.length}` +
      (fail.length ? `\n失败明细：\n${fail.map((x) => `${x.id}  ${x.reason}`).join("\n")}` : "")
    );

    await loadOrders(page);
    setBulkRunning(false);
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
    <div style={{ maxWidth: 1300, margin: "24px auto", padding: 16 }}>
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

      {/* Filters */}
      <div style={{ marginTop: 14, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr 1.3fr 2fr auto", gap: 10 }}>
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
            <span>产品</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }}>
              <option value="">全部</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.market}] {p.name}{p.is_active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>买手/成员</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }}>
              <option value="">全部</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.role} - {m.user_id}
                </option>
              ))}
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

      {/* Bulk bar */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "white" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>批量操作</div>
          <div style={{ color: "#6b7280" }}>已选：{selectedIds.length} / 当前页 {rows.length}</div>

          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8, minWidth: 180 }}>
            <option value="">选择要设置的状态</option>
            {STATUS_OPTIONS.filter((s) => s !== "canceled").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="note (写入审计)"
            style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8, minWidth: 220 }} />

          <button
            onClick={runBulk}
            disabled={bulkRunning}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "white", opacity: bulkRunning ? 0.6 : 1 }}
          >
            {bulkRunning ? "执行中..." : "执行批量状态变更"}
          </button>

          <button
            onClick={clearSelection}
            disabled={bulkRunning}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", opacity: bulkRunning ? 0.6 : 1 }}
          >
            清空勾选
          </button>
        </div>

        {bulkLog && (
          <pre style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#0b1020", color: "#e5e7eb", overflowX: "auto", maxHeight: 260 }}>
            {bulkLog.trimStart()}
          </pre>
        )}
      </div>

      {/* Table */}
      <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px 1.3fr 0.8fr 0.5fr 1.1fr 0.5fr 0.6fr 0.9fr 0.8fr", padding: 10, background: "#f3f4f6", fontWeight: 700, alignItems: "center" }}>
          <div>
            <input type="checkbox" checked={allCheckedOnPage} onChange={(e) => setAllOnPage(e.target.checked)} />
          </div>
          <div>订单号</div>
          <div>状态</div>
          <div>市场</div>
          <div>产品</div>
          <div>币种</div>
          <div>金额</div>
          <div>assigned_user</div>
          <div>更新</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 12, color: "#6b7280" }}>暂无数据</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "44px 1.3fr 0.8fr 0.5fr 1.1fr 0.5fr 0.6fr 0.9fr 0.8fr", padding: 10, borderTop: "1px solid #e5e7eb", alignItems: "center" }}>
              <div>
                <input
                  type="checkbox"
                  checked={!!selected[r.id]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                />
              </div>
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
              <div style={{ fontSize: 12, color: "#111827" }}>
                {r.product ? `[${r.product.market}] ${r.product.name}` : (r.product_id ? r.product_id : "-")}
              </div>
              <div>{r.currency}</div>
              <div>{Number(r.order_amount).toFixed(2)}</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#374151" }}>{r.assigned_user_id ?? "-"}</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>{new Date(r.updated_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || bulkRunning}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", opacity: page === 1 ? 0.5 : 1 }}
        >
          上一页
        </button>
        <div style={{ color: "#6b7280" }}>第 {page} 页（每页 {pageSize} 条）</div>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={bulkRunning}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
