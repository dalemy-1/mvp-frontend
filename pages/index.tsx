import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

/**
 * Root route:
 * - logged in  -> /app
 * - not logged -> /login
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? "/app" : "/login");
    })();
  }, [router]);

  return <div style={{ padding: 24 }}>Loading...</div>;
}
