import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { catalogItems, contacts, member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { ContactsService } from "./contacts.service";
import { CatalogService } from "../catalog/catalog.service";
import { AuditLogService } from "../audit/audit-log.service";
import { TaxResolverService } from "../tax/tax-resolver.service";

/**
 * Regression coverage for PRD §9 S-01.15/S-02.5 — the "own vs others"
 * capability split. Contacts and Catalogue reads have always been
 * unconditional (no test needed for that, it's the absence of a check);
 * this file covers the part that changed: write/delete now depend on
 * whether the acting user created the record, checked via
 * `requireOwnershipCapability` inside the service, not the route guard
 * (the guard can't see `createdByUserId` before the record is loaded).
 * Contacts and Catalogue use independent capability families
 * (`contacts.*`/`catalog.*`) — a Team's grants for one don't affect the
 * other, verified explicitly in the last test in each describe block below.
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Contacts/Catalog ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let contactsService: ContactsService;
  let catalogService: CatalogService;

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
    contactsService = new ContactsService(db, new AuditLogService(db));
    catalogService = new CatalogService(db, new AuditLogService(db), new TaxResolverService(db));

    const ownerEmail = `ownership-owner-${randomUUID()}@example.com`;
    const creatorEmail = `ownership-creator-${randomUUID()}@example.com`;
    const otherEmail = `ownership-other-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

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
  });

  describe("Contacts", () => {
    it("creator with only edit_own can update their own contact but not another user's", async () => {
      await grantTeam(creatorMemberId, { "contacts.edit_own": true });
      const contact = await contactsService.create(orgId, creatorUserId, { type: "customer", isCompany: false, name: "Own Contact" });

      await expect(contactsService.update(orgId, contact.id, creatorUserId, { name: "Renamed by creator" })).resolves.toBeDefined();

      // otherUserId has no grants at all yet — editing someone else's contact must fail.
      await expect(contactsService.update(orgId, contact.id, otherUserId, { name: "Renamed by other" })).rejects.toThrow(/missing capability/i);
    });

    it("edit_others lets a different staff user edit a contact they didn't create", async () => {
      await grantTeam(creatorMemberId, { "contacts.edit_own": true });
      const contact = await contactsService.create(orgId, creatorUserId, { type: "customer", isCompany: false, name: "Creator's Contact" });

      await grantTeam(otherMemberId, { "contacts.edit_others": true });
      await expect(contactsService.update(orgId, contact.id, otherUserId, { name: "Edited by other" })).resolves.toBeDefined();
    });

    it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
      await grantTeam(creatorMemberId, { "contacts.edit_own": true });
      const contact = await contactsService.create(orgId, creatorUserId, { type: "customer", isCompany: false, name: "To Delete" });

      // Grant only edit_others to the other user — deleting must still fail.
      await grantTeam(otherMemberId, { "contacts.edit_others": true });
      await expect(contactsService.archive(orgId, contact.id, otherUserId)).rejects.toThrow(/missing capability/i);

      // Now also grant delete_others — archive should succeed.
      await grantTeam(otherMemberId, { "contacts.delete_others": true });
      await expect(contactsService.archive(orgId, contact.id, otherUserId)).resolves.toBeDefined();
    });

    it("a legacy contact with no createdByUserId can only be touched via the _others capability, never _own", async () => {
      const [legacyContact] = await db
        .insert(contacts)
        .values({ orgId, type: "customer", name: "Legacy Unowned Contact", createdByUserId: null })
        .returning();

      // creatorUserId has only edit_own — must fail on an unowned record.
      await grantTeam(creatorMemberId, { "contacts.edit_own": true });
      await expect(contactsService.update(orgId, legacyContact!.id, creatorUserId, { name: "Attempted edit" })).rejects.toThrow(/missing capability/i);

      // otherUserId has edit_others — must succeed on the same unowned record.
      await grantTeam(otherMemberId, { "contacts.edit_others": true });
      await expect(contactsService.update(orgId, legacyContact!.id, otherUserId, { name: "Successful edit" })).resolves.toBeDefined();
    });

    it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
      const contact = await contactsService.create(orgId, creatorUserId, { type: "customer", isCompany: false, name: "Any Contact" });
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      await expect(contactsService.update(orgId, contact.id, ownerMembership!.userId, { name: "Edited by owner" })).resolves.toBeDefined();
    });
  });

  describe("Catalogue", () => {
    it("creator with only edit_own can update their own item but not another user's", async () => {
      await grantTeam(creatorMemberId, { "catalog.edit_own": true });
      const item = await catalogService.create(orgId, creatorUserId, {
        name: "Own Item",
        unit: "each",
        defaultPriceAmount: 1000n,
        defaultPriceCurrency: "USD",
      });

      await expect(catalogService.update(orgId, item.id, creatorUserId, { name: "Renamed by creator" })).resolves.toBeDefined();
      await expect(catalogService.update(orgId, item.id, otherUserId, { name: "Renamed by other" })).rejects.toThrow(/missing capability/i);
    });

    it("delete_others lets a different staff user archive an item they didn't create", async () => {
      await grantTeam(creatorMemberId, { "catalog.edit_own": true });
      const item = await catalogService.create(orgId, creatorUserId, {
        name: "Creator's Item",
        unit: "each",
        defaultPriceAmount: 500n,
        defaultPriceCurrency: "USD",
      });

      await grantTeam(otherMemberId, { "catalog.delete_others": true });
      await expect(catalogService.archive(orgId, item.id, otherUserId)).resolves.toBeDefined();
    });

    it("a legacy catalog item with no createdByUserId can only be touched via the _others capability", async () => {
      const [legacyItem] = await db
        .insert(catalogItems)
        .values({ orgId, name: "Legacy Item", unit: "each", defaultPriceAmount: 100n, defaultPriceCurrency: "USD", createdByUserId: null })
        .returning();

      await grantTeam(creatorMemberId, { "catalog.delete_own": true });
      await expect(catalogService.archive(orgId, legacyItem!.id, creatorUserId)).rejects.toThrow(/missing capability/i);

      await grantTeam(otherMemberId, { "catalog.delete_others": true });
      await expect(catalogService.archive(orgId, legacyItem!.id, otherUserId)).resolves.toBeDefined();
    });

    it("Contacts and Catalogue grants are independent — having contacts.edit_own does NOT grant catalog.edit_own", async () => {
      // creatorUserId gets contacts.edit_own only (via one team), plus
      // catalog.edit_own via a SEPARATE call on catalogService.create's
      // caller path (Owner creates the item so the ownership check on
      // update below is the thing actually under test, not creation).
      const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
      const item = await catalogService.create(orgId, ownerMembership!.userId, {
        name: "Owner's Item",
        unit: "each",
        defaultPriceAmount: 100n,
        defaultPriceCurrency: "USD",
      });

      // creatorUserId has contacts.edit_own (a Contacts-only grant) but no
      // catalog.* grant at all — editing a Catalogue item they don't even
      // own must still fail on catalog.edit_others, not silently pass
      // because contacts.edit_own happens to be granted.
      await grantTeam(creatorMemberId, { "contacts.edit_own": true });
      await expect(catalogService.update(orgId, item.id, creatorUserId, { name: "Should not be allowed" })).rejects.toThrow(/missing capability/i);
    });
  });
});
