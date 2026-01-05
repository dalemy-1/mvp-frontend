import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/app");
    } catch (err: any) {
      setMsg(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", padding: 24, border: "1px solid #e5e7eb", borderRadius: 12 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>登录</h1>
      <p style={{ marginTop: 8, color: "#6b7280" }}>仅管理员创建账号；前端不提供注册。</p>

      <form onSubmit={onLogin} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>邮箱</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required
            style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>密码</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 8 }} />
        </label>

        <button disabled={loading} style={{
          padding: 10, borderRadius: 8, border: "1px solid #111827",
          background: loading ? "#9ca3af" : "#111827", color: "white", cursor: loading ? "not-allowed" : "pointer"
        }}>
          {loading ? "登录中..." : "登录"}
        </button>

        {msg && <div style={{ color: "#b91c1c", whiteSpace: "pre-wrap" }}>{msg}</div>}
      </form>
    </div>
  );
}
