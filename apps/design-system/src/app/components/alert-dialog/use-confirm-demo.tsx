"use client";

import { useState } from "react";
import { Button, useConfirm } from "@spine/ui";

/** The useConfirm example: the answer shows under the buttons. */
export function UseConfirmDemo() {
  const { confirm, dialog } = useConfirm();
  const [answer, setAnswer] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <Button
          onClick={async () => {
            const ok = await confirm({ title: "Record this bill?", description: "Northwind Supplies' bill NW-2231 for $1,240.00 is posted to your books as owed. After that it can't be edited — only voided.", confirmLabel: "Record bill" });
            setAnswer(ok ? "Recorded." : "Nothing changed.");
          }}
        >
          Record
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            const ok = await confirm({ title: "Delete this refund?", description: "The $80.00 refund is reversed in your books.", confirmLabel: "Delete refund", danger: true });
            setAnswer(ok ? "Deleted." : "Nothing changed.");
          }}
        >
          Delete refund
        </Button>
      </div>
      {answer && <p className="text-[13px] text-on-surface-muted">{answer}</p>}
      {dialog}
    </div>
  );
}
