import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { getMyTeamContext, requireSessionOrRedirect } from "../../lib/team";

type Order = {
  id: string;
  team_id: string;
  assigned_user_id: string | null;
  order_no: string;
  status: string;
  market: string;
  currency: string;
  order_amount: number;
  discount: number;
  review_link: string | null;
  updated_at: string;
};

type Attachment = {
  id: string;
  attachment_type: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
};

function nowStamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
}

export default function OrderDetailPage() {
  const router = useRouter();
  const orderId = router.query.id as string | undefined;

  const [uid, setUid] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reviewLink, setReviewLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
      setTeamId(ctx.teamId);
      setRole(ctx.role);

      const { data: o, error: oe } = await supabase
        .from("orders")
        .select("id, team_id, assigned_user_id, order_no, status, market, currency, order_amount, discount, review_link, updated_at")
        .eq("id", orderId)
        .single();

      if (oe) throw oe;
      setOrder(o as any);
      setReviewLink((o as any).review_link ?? "");

      const { data: a, error: ae } = await supabase
        .from("order_attachments")
        .select("id, attachment_type, storage_bucket, storage_path, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (ae) throw ae;
      setAttachments((a ?? []) as any);

    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orderId]);

  async function saveReviewLink() {
    if (!orderId) return;
    setMsg(null);
    setErr(null);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ review_link: reviewLink.trim() || null })
        .eq("id", orderId);
      if (error) throw error;
      setMsg("已保存 review_link");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  async function uploadAndAttach(file: File, attachmentType: "order_screenshot" | "review_screenshot" | "payout_screenshot" | "other") {
    if (!orderId || !teamId) throw new Error("missing orderId/teamId");
    const ext = file.name.split(".").pop() || "bin";
    const safeName = file.name.replaceAll(" ", "_");
    const path = `teams/${teamId}/orders/${orderId}/${attachmentType}/${nowStamp()}_${safeName}`;

    // 1) upload
    const { error: upErr } = await supabase.storage.from("order-files").upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });
    if (upErr) throw upErr;

    // 2) insert attachment record
    const { error: insErr } = await supabase.from("order_attachments").insert({
      team_id: teamId,
      order_id: orderId,
      attachment_type: attachmentType,
      storage_bucket: "order-files",
      storage_path: path,
      uploaded_by: uid
    });
    if (insErr) throw insErr;

    setMsg(`已上传：${attachmentType}`);
    await load();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>, type: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null);
    setMsg(null);
    try {
      await uploadAndAttach(f, type);
    } catch (er: any) {
      setErr(er?.message ?? String(er));
    } finally {
      e.target.value = "";
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (err) return <div style={{ padding: 24, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{err}</div>;
  if (!order) return <div style={{ padding: 24 }}>Not found</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>订单详情</h1>
          <div style={{ color: "#6b7280", marginTop: 4 }}>{order.order_no} | {order.market} | {order.status}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/app" style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, background: "white" }}>返回列表</Link>
          {isAdmin && (
            <Link href={`/admin/orders/${order.id}`} style={{ padding: "8px 12px", border: "1px solid #111827", borderRadius: 8, background: "#111827", color: "white" }}>
              管理员操作
            </Link>
          )}
        </div>
      </div>

      {msg && <div style={{ marginTop: 12, padding: 10, background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 10 }}>{msg}</div>}

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>基本信息</div>
          <div>金额：{Number(order.order_amount).toFixed(2)} {order.currency}</div>
          <div>折扣：{Number(order.discount).toFixed(2)}</div>
          <div style={{ color: "#6b7280", marginTop: 6 }}>updated_at：{new Date(order.updated_at).toLocaleString()}</div>
        </div>

        <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>留评链接（可替代留评截图）</div>
          <input value={reviewLink} onChange={(e) => setReviewLink(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
          <button onClick={saveReviewLink} style={{ marginTop: 10, padding: "8px 12px", border: "1px solid #111827", borderRadius: 8, background: "#111827", color: "white" }}>
            保存
          </button>
          <div style={{ color: "#6b7280", marginTop: 8 }}>
            规则：进入 <b>review_done</b> 前，必须有留评截图或留评链接（二选一）。
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>上传证据</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <b>留评截图（review_screenshot）</b>
            <input type="file" accept="image/*" onChange={(e) => onFileChange(e, "review_screenshot")} />
          </label>

          <label style={{ display: "grid", gap: 6, padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <b>返款截图（payout_screenshot）</b>
            <input type="file" accept="image/*" onChange={(e) => onFileChange(e, "payout_screenshot")} />
          </label>

          <label style={{ display: "grid", gap: 6, padding: 12, border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <b>其他附件（other）</b>
            <input type="file" onChange={(e) => onFileChange(e, "other")} />
          </label>
        </div>

        <div style={{ color: "#6b7280", marginTop: 10 }}>
          上传后会写入 <code>order_attachments</code>，并按固定路径写入 Storage。
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>附件列表</div>
        {attachments.length === 0 ? (
          <div style={{ color: "#6b7280" }}>暂无附件</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {attachments.map(a => (
              <div key={a.id} style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <div><b>{a.attachment_type}</b> <span style={{ color: "#6b7280" }}>{new Date(a.created_at).toLocaleString()}</span></div>
                <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 6, color: "#374151" }}>
                  {a.storage_bucket}:{a.storage_path}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
