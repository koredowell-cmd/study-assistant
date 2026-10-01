"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "study-assistant-output";

const SECTION_NAMES = [
  "OVERVIEW",
  "DETAILED STUDY NOTES",
  "KEY TERMS",
  "COMPARISONS",
  "PRACTICE QUESTIONS",
];

const ALIASES: Record<string, string> = {
  SUMMARY: "OVERVIEW",
  "STUDY NOTES": "DETAILED STUDY NOTES",
  "DETAILED NOTES": "DETAILED STUDY NOTES",
  "KEY TERMS AND DEFINITIONS": "KEY TERMS",
  "KEY TERMS & DEFINITIONS": "KEY TERMS",
  COMPARISON: "COMPARISONS",
  "PRACTICE QUESTIONS AND ANSWERS": "PRACTICE QUESTIONS",
};

type Section = { title: string; lines: string[] };

function matchSection(line: string): string | null {
  const clean = line
    .replace(/[*#:_`]/g, "")
    .replace(/^\s*(section\s*)?\d+[.)]?\s*/i, "")
    .replace(/^[-–—•]\s*/, "")
    .trim()
    .toUpperCase();
  if (SECTION_NAMES.includes(clean)) return clean;
  return ALIASES[clean] ?? null;
}

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of text.split("\n")) {
    const name = matchSection(raw);
    if (name) {
      current = { title: name, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "NOTES", lines: [] };
      sections.push(current);
    }
    current.lines.push(raw.replace(/\*\*/g, ""));
  }
  return sections.filter((s) => s.lines.some((l) => l.trim() !== ""));
}

function isHeading(line: string) {
  const t = line.trim();
  return t.length > 2 && t.length < 80 && t === t.toUpperCase() && /[A-Z]{3}/.test(t);
}

function renderLine(line: string, title: string, i: number) {
  const t = line.trim().replace(/^[-•]\s*/, "");
  if (t === "") return <div key={i} className="h-2" />;

  if (isHeading(t)) {
    return (
      <h3 key={i} className="mt-5 text-base font-bold text-gray-900">
        {t}
      </h3>
    );
  }

  if (/^part [abc]/i.test(t)) {
    return (
      <h3 key={i} className="mt-5 text-base font-bold text-blue-700">
        {t}
      </h3>
    );
  }

  const answer = t.match(/^answer\s*:\s*(.*)$/i);
  if (answer) {
    return (
      <p key={i} className="mt-1 rounded bg-green-50 px-2 py-1 text-green-900">
        <span className="font-semibold">Answer:</span> {answer[1]}
      </p>
    );
  }

  if (title === "KEY TERMS") {
    const term = t.match(/^([^:]{2,60}):\s*(.+)$/);
    if (term) {
      return (
        <p key={i} className="mt-2">
          <span className="font-semibold text-gray-900">{term[1]}:</span> {term[2]}
        </p>
      );
    }
  }

  return (
    <p key={i} className="mt-1">
      {t}
    </p>
  );
}

export default function Home() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOutput(saved);
    } catch {}
  }, []);

  function clearNotes() {
    setOutput("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Try the Download button instead.");
    }
  }

  function downloadNotes() {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-notes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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

      setStatus("Creating your study notes and questions...");
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 60000) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      setOutput(data.output);
      try {
        localStorage.setItem(STORAGE_KEY, data.output);
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStatus("");
  }

  const sections = output ? parseSections(output) : [];

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

      {sections.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={copyNotes}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            {copied ? "Copied!" : "Copy notes"}
          </button>
          <button
            onClick={downloadNotes}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Download
          </button>
          <button
            onClick={clearNotes}
            className="text-sm text-gray-500 underline"
          >
            Clear notes
          </button>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mt-6 w-full space-y-3 text-left">
          {sections.map((s, idx) => (
            <details
              key={s.title + idx}
              open={idx < 2}
              className="rounded-lg border border-gray-200 bg-white"
            >
              <summary className="cursor-pointer select-none rounded-lg bg-gray-50 px-4 py-3 font-semibold text-gray-900">
                {s.title}
              </summary>
              <div className="px-4 pb-4 pt-2 text-sm leading-relaxed text-gray-800">
                {s.lines.map((line, i) => renderLine(line, s.title, i))}
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}