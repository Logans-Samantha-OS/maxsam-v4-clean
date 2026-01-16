"use client";

import { useEffect, useState } from "react";

type Metrics = {
  ok: boolean;
  totalContracts: number;
  signedContracts: number;
  totalRevenue: number;
  error?: string;
};

export default function CapitalFlowEngine() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const res = await fetch("/api/contracts/metrics", { cache: "no-store" });
        const data = (await res.json()) as Metrics;

        if (!alive) return;
        setMetrics(data);
      } catch (e) {
        if (!alive) return;
        setMetrics({
          ok: false,
          totalContracts: 0,
          signedContracts: 0,
          totalRevenue: 0,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="text-sm text-gray-400">Loading capital metrics…</div>;

  if (!metrics?.ok) {
    return (
      <div className="rounded-xl border border-red-500 bg-black p-4 text-white">
        <div className="font-semibold text-red-400">CapitalFlowEngine error</div>
        <div className="mt-1 text-sm text-gray-300">{metrics?.error ?? "Unknown error"}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-yellow-500 bg-black p-4 text-white">
      <div className="text-lg font-semibold text-yellow-400">Capital Flow Engine</div>

      <div className="mt-3 space-y-2 text-sm">
        <div>
          <span className="text-gray-400">Total Contracts:</span>{" "}
          <span className="font-mono text-yellow-300">{metrics.totalContracts}</span>
        </div>

        <div>
          <span className="text-gray-400">Signed Contracts:</span>{" "}
          <span className="font-mono text-yellow-300">{metrics.signedContracts}</span>
        </div>

        <div>
          <span className="text-gray-400">Total Revenue:</span>{" "}
          <span className="font-mono text-yellow-300">
            ${metrics.totalRevenue.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
