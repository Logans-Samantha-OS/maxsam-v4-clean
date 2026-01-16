"use client";

export default function NewContractButton() {
  return (
    <button
      className="rounded-lg border border-yellow-500 bg-black px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500 hover:text-black transition"
      onClick={() => alert("New Contract flow coming next")}
    >
      + New Contract
    </button>
  );
}
