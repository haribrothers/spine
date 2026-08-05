"use client";

import { useState } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { OnThisPage } from "./on-this-page";
import { SearchPalette } from "./search-palette";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <TopBar onSearchOpen={() => setSearchOpen(true)} />
      <div className="mx-auto flex max-w-[1200px]">
        <Sidebar />
        <article className="min-w-0 flex-1 py-8">{children}</article>
        <OnThisPage />
      </div>
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
