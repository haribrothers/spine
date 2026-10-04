import { Logger } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/client";
import { organization, settings } from "../../db/schema";
import { EMAIL_COLORS, type EmailBrand } from "./email-layout";

type FileReader = (orgId: string, fileId: string) => Promise<{ bytes: Buffer; mimeType: string }>;

/**
 * The logo is read through `FilesService` (and so the storage driver), which
 * registers itself here when it starts. A module-level hook rather than DI:
 * Better Auth's emails (auth.ts) live outside Nest, and Notifications →
 * Files → Notifications would otherwise be a cycle. Without it, emails show
 * the business name only.
 */
let readFile: FileReader | null = null;
export function registerEmailLogoReader(reader: FileReader): void {
  readFile = reader;
}

const logger = new Logger("EmailBrand");
const HEX = /^#[0-9a-fA-F]{6}$/;

interface BusinessProfile {
  name?: string;
  logoUrl?: string;
  address?: string;
}
interface Branding {
  documentColor?: string;
  documentFooter?: string;
}

/**
 * The business as its emails show it: name and address from
 * `business_profile`, colour and footer text from `branding` (US-SET-10,
 * when set), the organisation's name as a fallback.
 */
export async function loadEmailBrand(db: Database, orgId: string): Promise<EmailBrand> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.orgId, orgId), inArray(settings.key, ["business_profile", "branding"])));
  const profile = (rows.find((r) => r.key === "business_profile")?.value ?? {}) as BusinessProfile;
  const branding = (rows.find((r) => r.key === "branding")?.value ?? {}) as Branding;

  let name = profile.name?.trim();
  if (!name) {
    const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, orgId));
    name = org?.name?.trim() || "Spine";
  }

  const footer = [name, profile.address?.replace(/\s*\n\s*/g, ", ").trim(), branding.documentFooter?.trim()].filter(Boolean).join(" · ");
  return {
    name,
    color: branding.documentColor && HEX.test(branding.documentColor) ? branding.documentColor : EMAIL_COLORS.primary,
    footer,
    logo: await loadLogo(orgId, profile.logoUrl),
  };
}

async function loadLogo(orgId: string, logoUrl: string | undefined): Promise<EmailBrand["logo"]> {
  const fileId = logoUrl?.match(/\/files\/([0-9a-fA-F-]{36})/)?.[1];
  if (!fileId || !readFile) return undefined;
  try {
    const { bytes, mimeType } = await readFile(orgId, fileId);
    return { content: bytes, contentType: mimeType };
  } catch (err) {
    logger.warn(`Email sent without the logo: ${(err as Error).message}`);
    return undefined;
  }
}
