import { auth } from "../../auth/auth";
import { createDb } from "../client";
import { member, organization } from "../schema";
import { eq } from "drizzle-orm";
import { seedChartOfAccounts } from "./chart-of-accounts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  const db = createDb(databaseUrl);

  const email = process.env.SEED_OWNER_EMAIL ?? "owner@example.com";
  const password = process.env.SEED_OWNER_PASSWORD ?? "spine-dev-password";
  const name = process.env.SEED_OWNER_NAME ?? "Demo Owner";

  // Signing up (rather than inserting rows directly) exercises the same
  // path a real user takes and triggers the databaseHooks.user.create.after
  // hook in src/auth/auth.ts, which creates the org and makes this user its
  // owner — so the seeded org is identical in shape to any real signup.
  const signUpResult = await auth.api.signUpEmail({ body: { email, password, name } });
  const userId = signUpResult.user.id;

  const [membership] = await db.select().from(member).where(eq(member.userId, userId));
  if (!membership) {
    throw new Error("Expected the signup hook to have created an organisation membership");
  }

  const [org] = await db.select().from(organization).where(eq(organization.id, membership.organizationId));
  if (!org) {
    throw new Error("Failed to find seed organisation");
  }

  await seedChartOfAccounts(db, org.id);

  console.log(`Seeded chart of accounts for org ${org.id} (${org.name})`);
  console.log(`Demo owner login: ${email} / ${password}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
