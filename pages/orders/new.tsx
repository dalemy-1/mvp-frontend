import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { getMyTeamContext, requireSessionOrRedirect } from "../../lib/team";

type Product = { id: string; name: string; market: string; asin: string | null; currency: string | null; price: number | null; };

export default function NewOrderPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = useMemo(() => products.find(p => p.id === productId) ?? null, [products, productId]);

  useEffect(() => {
    (async () => {
      setErr(null);
      const session = await requireSessionOrRedirect(router.push);
      if (!session) return;
      setUid(session.user.id);

      try {
        const ctx = await getMyTeamContext();
        setTeamId(ctx.teamId);

        const { data, error } = await supabase
          .from("products")
          .select("id, name, market, asin, currency, price")
          .eq("team_id", ctx.teamId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(500);

        if (error) throw error;
        setProducts((data ?? []) as any);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!teamId || !uid) return;
    if (!productId) {
      setErr("必须选择产品（不允许 product_id 为空）。");
      return;
    }
    if (!selected) {
      setErr("所选产品不存在。");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        team_id: teamId,
        created_by: uid,
        assigned_user_id: uid,
        seller_id: null,
        product_id: selected.id,
        order_no: orderNo.trim(),
        market: selected.market,
        currency: selected.currency ?? "USD",
        order_amount: Number(orderAmount),
        discount: Number(discount || "0"),
        review_req: "text",
        note: note.trim() || null
      };

      const { data, error } = await supabase
        .from("orders")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      router.replace(`/orders/${data.id}`);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>新建订单</h1>
      <div style={{ color: "#6b7280", marginTop: 6 }}>必须选择产品；市场/币种会从产品带入。</div>

      {loading && <div style={{ marginTop: 16 }}>加载中...</div>}
      {err && <div style={{ marginTop: 16, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{err}</div>}

      {!loading && (
        <form onSubmit={onCreate} style={{ marginTop: 16, display: "grid", gap: 12, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>选择产品（必选）</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} required
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }}>
              <option value="">请选择...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.market}] {p.name} {p.asin ? `(${p.asin})` : ""}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <div style={{ padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10 }}>
              <div><b>国家/市场</b>：{selected.market}</div>
              <div><b>币种</b>：{selected.currency ?? "-"}</div>
              <div><b>参考价格</b>：{selected.price ?? "-"} </div>
            </div>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            <span>订单号（必填）</span>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} required placeholder="111-xxxxxxx-xxxxxxx"
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>订单金额（必填）</span>
              <input value={orderAmount} onChange={(e) => setOrderAmount(e.target.value)} required inputMode="decimal"
                style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>折扣（可选）</span>
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal"
                style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span>备注（可选）</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={saving} style={{
              padding: "10px 14px", borderRadius: 8, border: "1px solid #111827",
              background: saving ? "#9ca3af" : "#111827", color: "white"
            }}>
              {saving ? "创建中..." : "创建订单"}
            </button>
            <button type="button" onClick={() => router.push("/app")} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "white" }}>
              返回
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
