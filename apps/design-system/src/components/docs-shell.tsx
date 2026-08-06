"use client";

import { TooltipProvider } from "@spine/ui";
import { useState } from "react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { OnThisPage } from "./on-this-page";
import { SearchPalette } from "./search-palette";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <TopBar onSearchOpen={() => setSearchOpen(true)} />
        <div className="mx-auto flex">
          <Sidebar />
          <article className="min-w-0 mx-auto max-w-[858px] flex-1 py-8">{children}</article>
          <OnThisPage />
        </div>
        <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </TooltipProvider>
  );
}
