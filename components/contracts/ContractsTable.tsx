"use client";

import { useEffect, useState } from "react";

type Contract = {
  id: string;
  title: string;
  counterparty: string | null;
  status: string;
  value_cents: number;
};

export default function ContractsTable() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/contracts");
      const json = await res.json();
      setRows(json.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading contracts…</div>;
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-black p-4">
      <table className="w-full text-sm text-gray-300">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="py-2 text-left">Title</th>
            <th>Status</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id} className="border-b border-gray-800">
              <td className="py-2">{c.title}</td>
              <td>{c.status}</td>
              <td>${Number(c.value_cents ?? 0).toLocaleString()}</td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
