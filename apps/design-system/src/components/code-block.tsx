"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({ code, language = "tsx" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-neutral-900 text-neutral-50">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-neutral-50 group-hover:opacity-100"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  );
}
