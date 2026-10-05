import { Controller, Get } from "@nestjs/common";
import { OrgRoles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { requireOrgId } from "../org/settings.controller";
import { InvoiceRemindersService } from "./invoice-reminders.service";

/** US-INV-18 — automatic reminders are organisation settings, so Owner-only. */
@Controller("invoice-reminders")
export class InvoiceRemindersController {
  constructor(private readonly reminders: InvoiceRemindersService) {}

  /** "Preview email" in Settings › Automatic reminders. */
  @Get("preview")
  @OrgRoles(["owner"])
  async preview(@Session() session: UserSession) {
    return this.reminders.preview(requireOrgId(session));
  }
}
