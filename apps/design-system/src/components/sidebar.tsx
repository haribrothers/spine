"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  const activeTop = nav.find((section) => pathname.startsWith(`/${section.slug}`)) ?? nav[0];

  if (!activeTop) return null;

  return (
    <nav className="w-56 shrink-0 space-y-6 py-8 pr-4">
      {activeTop.sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-muted">
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? "bg-surface-sunken font-medium text-primary"
                        : "text-on-surface-muted hover:text-on-surface"
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
