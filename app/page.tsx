"use client";

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setOutput("");

    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File is too large. Please use a PDF under 50MB.");
      }

      setStatus("Reading your slides...");
      const { extractText, getDocumentProxy } = await import("unpdf");
      const buffer = await file.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });

      if (text.trim().length < 50) {
        throw new Error(
          "Could not find readable text in this PDF. It may be scanned images."
        );
      }

      setStatus("Creating your summary and questions...");
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 60000) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      setOutput(data.output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStatus("");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center p-6 pt-16 text-center">
      <h1 className="text-3xl font-bold">Study Assistant</h1>
      <p className="mt-3 text-gray-600">
        Upload your lecture slides and get a summary and practice questions.
      </p>

      <label className="mt-8 cursor-pointer rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
        Choose a PDF
        <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      </label>

      {status && <p className="mt-4 text-gray-600">{status}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {output && (
        <div className="mt-6 w-full rounded-lg border p-4 text-left">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{output}</p>
        </div>
      )}
    </main>
  );
}