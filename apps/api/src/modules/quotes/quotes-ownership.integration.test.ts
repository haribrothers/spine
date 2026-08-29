import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { contacts, files, member, quotes, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { QuotesService } from "./quotes.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { SettingsService } from "../org/settings.service";
import { QueueService } from "../queue/queue.service";
import { QuotePublicTokenService } from "./quote-public-token.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../notifications/push.service";

/**
 * Regression coverage for the own/others capability split extended to
 * Quotes (Phase 1 of extending the pattern beyond Contacts/Catalogue/
 * Leads/Activities/Meetings). `quotes.manage` is replaced by
 * `quotes.edit_own`/`edit_others`/`delete_own`/`delete_others`; `send`/
 * `revise` are separate, dedicated capabilities (not part of this test
 * file's scope — they're simple @RequireCapability route gates, no
 * ownership check, already covered structurally by CapabilityGuard's own
 * tests).
 *
 * QueueService is constructed directly without calling its
 * `onModuleInit` lifecycle hook (which would connect a real pg-boss
 * instance) — none of create/update/delete touch `this.queue`, only
 * `send()` does, which this file doesn't exercise.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Quotes ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let contactId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let fieldUserId: string;
  let quotesService: QuotesService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  async function grantTeam(memberId: string, grants: Partial<Record<Capability, boolean>>) {
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    const rows = Object.entries(grants).map(([capability, granted]) => ({
      teamId: team!.id,
      capability: capability as Capability,
      granted: granted ?? false,
    }));
    if (rows.length) {
      await db.insert(teamPrivileges).values(rows);
    }
    return team!.id;
  }

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    quotesService = new QuotesService(
      db,
      auditLog,
      new NumberingService(db),
      new SettingsService(db),
      new QueueService(db),
      new QuotePublicTokenService(db),
      new TaxResolverService(db),
      new NotificationsService(db, new QueueService(db), new PushService(db)),
    );

    const ownerEmail = `quote-owner-${randomUUID()}@example.com`;
    const creatorEmail = `quote-creator-${randomUUID()}@example.com`;
    const otherEmail = `quote-other-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Test Contact" }).returning();
    contactId = contact!.id;

    const creator = await auth.api.signUpEmail({ body: { email: creatorEmail, password: "testpassword123", name: "Ownership Creator" } });
    creatorUserId = creator.user.id;
    await db.delete(member).where(eq(member.userId, creator.user.id));
    const [creatorMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: creator.user.id, role: "staff", createdAt: new Date() })
      .returning();
    creatorMemberId = creatorMember!.id;

    const other = await auth.api.signUpEmail({ body: { email: otherEmail, password: "testpassword123", name: "Ownership Other" } });
    otherUserId = other.user.id;
    await db.delete(member).where(eq(member.userId, other.user.id));
    const [otherMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: other.user.id, role: "staff", createdAt: new Date() })
      .returning();
    otherMemberId = otherMember!.id;

    const fieldEmail = `quote-field-${randomUUID()}@example.com`;
    createdEmails.push(fieldEmail);
    const field = await auth.api.signUpEmail({ body: { email: fieldEmail, password: "testpassword123", name: "Ownership Field" } });
    fieldUserId = field.user.id;
    await db.delete(member).where(eq(member.userId, field.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.user.id, role: "field", createdAt: new Date() });
  });

  it("creator with only edit_own can update their own draft quote but not another user's", async () => {
    await grantTeam(creatorMemberId, { "quotes.edit_own": true });
    const quote = await quotesService.create(orgId, creatorUserId, { contactId, currency: "USD", lines: [] });

    await expect(quotesService.update(orgId, quote.id, creatorUserId, { notes: "Edited by creator" })).resolves.toBeDefined();
    await expect(quotesService.update(orgId, quote.id, otherUserId, { notes: "Edited by other" })).rejects.toThrow(/missing capability/i);
  });

  it("edit_others lets a different staff user edit a draft quote they didn't create", async () => {
    await grantTeam(creatorMemberId, { "quotes.edit_own": true });
    const quote = await quotesService.create(orgId, creatorUserId, { contactId, currency: "USD", lines: [] });

    await grantTeam(otherMemberId, { "quotes.edit_others": true });
    await expect(quotesService.update(orgId, quote.id, otherUserId, { notes: "Edited by other" })).resolves.toBeDefined();
  });

  it("ownership check runs before the draft-only status check — editing a sent quote still 403s a non-owner before hitting the 400", async () => {
    await grantTeam(creatorMemberId, { "quotes.edit_own": true, "quotes.send": true });
    const quote = await quotesService.create(orgId, creatorUserId, { contactId, currency: "USD", lines: [] });
    await quotesService.send(orgId, quote.id, creatorUserId);

    // otherUserId has no grants at all — must get a 403 (missing capability),
    // not a 400 (only draft can be edited), proving the ownership check runs
    // first regardless of the quote's status.
    await expect(quotesService.update(orgId, quote.id, otherUserId, { notes: "x" })).rejects.toThrow(/missing capability/i);
  });

  it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
    await grantTeam(creatorMemberId, { "quotes.edit_own": true });
    const quote = await quotesService.create(orgId, creatorUserId, { contactId, currency: "USD", lines: [] });

    await grantTeam(otherMemberId, { "quotes.edit_others": true });
    await expect(quotesService.delete(orgId, quote.id, otherUserId)).rejects.toThrow(/missing capability/i);

    await grantTeam(otherMemberId, { "quotes.delete_others": true });
    await expect(quotesService.delete(orgId, quote.id, otherUserId)).resolves.toBeDefined();
  });

  it("a legacy quote with no createdByUserId can only be touched via the _others capability, never _own", async () => {
    const [legacyQuote] = await db
      .insert(quotes)
      .values({ orgId, contactId, currency: "USD", status: "draft", createdByUserId: null })
      .returning();

    await grantTeam(creatorMemberId, { "quotes.edit_own": true });
    await expect(quotesService.update(orgId, legacyQuote!.id, creatorUserId, { notes: "Attempted edit" })).rejects.toThrow(/missing capability/i);

    await grantTeam(otherMemberId, { "quotes.edit_others": true });
    await expect(quotesService.update(orgId, legacyQuote!.id, otherUserId, { notes: "Successful edit" })).resolves.toBeDefined();
  });

  it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
    const quote = await quotesService.create(orgId, creatorUserId, { contactId, currency: "USD", lines: [] });
    const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
    await expect(quotesService.update(orgId, quote.id, ownerMembership!.userId, { notes: "Edited by owner" })).resolves.toBeDefined();
  });

  /**
   * Phase 5 (Mobile) — `quotes.accept_in_person` is a single plain
   * capability, not own/others-shaped, and Field always passes it
   * unconditionally (FIELD_ALWAYS_CAPABILITIES) since S-11.7 is exactly
   * this story. Distinct from the public accept-link path
   * (public-quotes-respond-notifications.integration.test.ts) —
   * acceptedByUserId/acceptanceMethod are the two facts this path uniquely
   * records.
   */
  describe("Accept in person", () => {
    async function sentQuote() {
      const quote = await quotesService.create(orgId, creatorUserId, { contactId, currency: "USD", lines: [] });
      await grantTeam(creatorMemberId, { "quotes.edit_own": true, "quotes.send": true });
      return quotesService.send(orgId, quote.id, creatorUserId);
    }

    async function signatureFileId() {
      const [file] = await db
        .insert(files)
        .values({ orgId, key: `test/${randomUUID()}.png`, originalFilename: "signature.png", mimeType: "image/png", sizeBytes: 512, uploadedByUserId: fieldUserId })
        .returning();
      return file!.id;
    }

    it("a Staff user with no quotes.accept_in_person grant cannot accept in person", async () => {
      const quote = await sentQuote();
      const signatureFileId1 = await signatureFileId();
      await expect(
        quotesService.acceptInPerson(orgId, quote.id, otherUserId, { signatureFileId: signatureFileId1, comment: null }),
      ).rejects.toThrow(/missing capability/i);
    });

    it("Field always passes quotes.accept_in_person unconditionally, with zero Team grants", async () => {
      const quote = await sentQuote();
      const signature = await signatureFileId();
      const updated = await quotesService.acceptInPerson(orgId, quote.id, fieldUserId, { signatureFileId: signature, comment: "Signed on site" });
      expect(updated.status).toBe("accepted");
    });

    it("records acceptedByUserId and acceptanceMethod: in_person, distinct from the public accept-link path", async () => {
      const quote = await sentQuote();
      const signature = await signatureFileId();
      await quotesService.acceptInPerson(orgId, quote.id, fieldUserId, { signatureFileId: signature, comment: null });

      const [row] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
      expect(row!.status).toBe("accepted");
      expect(row!.acceptanceMethod).toBe("in_person");
      expect(row!.acceptedByUserId).toBe(fieldUserId);
    });

    it("a second accept-in-person attempt on an already-accepted quote is rejected, not silently re-applied", async () => {
      const quote = await sentQuote();
      const signature = await signatureFileId();
      await quotesService.acceptInPerson(orgId, quote.id, fieldUserId, { signatureFileId: signature, comment: null });

      await expect(
        quotesService.acceptInPerson(orgId, quote.id, fieldUserId, { signatureFileId: signature, comment: null }),
      ).rejects.toThrow(/already been accepted/i);
    });

    it("rejects a signatureFileId that doesn't belong to this org", async () => {
      const quote = await sentQuote();
      await expect(
        quotesService.acceptInPerson(orgId, quote.id, fieldUserId, { signatureFileId: randomUUID(), comment: null }),
      ).rejects.toThrow(/signature file not found/i);
    });

    it("Owner bypasses the capability check entirely", async () => {
      const quote = await sentQuote();
      const signature = await signatureFileId();
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      const updated = await quotesService.acceptInPerson(orgId, quote.id, ownerMembership!.userId, { signatureFileId: signature, comment: null });
      expect(updated.status).toBe("accepted");
    });
  });
});
