"use client";

import { useState } from "react";

export default function TestPage() {
  const [result, setResult] = useState<any>(null);

  const callAPI = async () => {
    const res = await fetch("/api/public-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roadAddress: "서울특별시 송파구 잠실동",
      }),
    });

    const text = await res.text();

    try {
      setResult(JSON.parse(text));
    } catch {
      setResult({
        error: "JSON 아님 (HTML 반환됨)",
        raw: text,
      });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>API TEST</h2>
      <button onClick={callAPI}>CALL</button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
