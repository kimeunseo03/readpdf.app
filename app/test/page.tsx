"use client";

import { useState } from "react";

export default function TestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/public-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roadAddress: "서울특별시 송파구 잠실동",
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>API 테스트 페이지</h2>

      <button onClick={testAPI} disabled={loading}>
        {loading ? "요청중..." : "API 호출"}
      </button>

      <pre style={{ marginTop: 20, background: "#111", color: "#0f0", padding: 10 }}>
        {result ? JSON.stringify(result, null, 2) : "결과 없음"}
      </pre>
    </div>
  );
}
