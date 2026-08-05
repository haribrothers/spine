"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function OnThisPage() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll("article h2, article h3"));
    setHeadings(
      nodes.map((node) => ({
        id: node.id,
        text: node.textContent ?? "",
        level: node.tagName === "H2" ? 2 : 3,
      })),
    );
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <nav className="w-48 shrink-0 py-8 pl-4">
      <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted">
        On this page
      </h3>
      <ul className="space-y-0.5">
        {headings.map((heading) => (
          <li key={heading.id} style={{ paddingLeft: heading.level === 3 ? 12 : 0 }}>
            <a
              href={`#${heading.id}`}
              className="block rounded-md px-2 py-1 text-[13px] text-on-surface-muted transition-colors hover:text-on-surface"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
