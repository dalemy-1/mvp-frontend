import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/orders");
  }, [router]);
  return <div style={{ padding: 24 }}>Loading...</div>;
}
