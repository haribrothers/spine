import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Ban,
  Banknote,
  Bell,
  Camera,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileMinus,
  FileText,
  GitBranch,
  HardHat,
  History,
  Link2,
  LockOpen,
  Mail,
  Package,
  PanelRightOpen,
  Pencil,
  Receipt,
  RotateCw,
  Send,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";

/**
 * D-222 — the one icon for each menu action, the same on every screen.
 * A menu item puts it first (`<MENU_ICONS.view aria-hidden />`); the menu
 * component sets its size, colour and spacing (US-OPS-37).
 */
export const MENU_ICONS = {
  view: Eye,
  /** Open a record from another page (an invoice from a payment, an email's record). */
  open: FileText,
  /** Open a record's drawer. */
  openDrawer: PanelRightOpen,
  edit: Pencil,
  duplicate: Copy,
  delete: Trash2,
  archive: Archive,
  restore: ArchiveRestore,
  issue: FileCheck,
  /** Send a quote. */
  send: Send,
  /** Email an invoice, a receipt or a credit note, or a quote again. */
  email: Mail,
  remind: Bell,
  recordPayment: Banknote,
  refund: Banknote,
  applyCredit: ArrowRightLeft,
  issueCreditNote: FileMinus,
  moveOff: Undo2,
  /** Move a lead to another stage. */
  moveTo: ArrowRightLeft,
  void: Ban,
  cancel: Ban,
  download: Download,
  copyLink: Link2,
  convertToInvoice: Receipt,
  convertToJob: HardHat,
  revise: GitBranch,
  history: History,
  saveBundle: Package,
  addPhotos: Camera,
  releaseRetention: LockOpen,
  retry: RotateCw,
  moveUp: ArrowUp,
  moveDown: ArrowDown,
} satisfies Record<string, LucideIcon>;
