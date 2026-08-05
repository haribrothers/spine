import { createDb } from "../client";
import { organisations } from "../schema";
import { seedChartOfAccounts } from "./chart-of-accounts";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  const db = createDb(databaseUrl);

  const [org] = await db
    .insert(organisations)
    .values({ name: process.env.SEED_ORG_NAME ?? "Demo Org" })
    .returning();

  if (!org) {
    throw new Error("Failed to create seed organisation");
  }

  await seedChartOfAccounts(db, org.id);

  console.log(`Seeded chart of accounts for org ${org.id} (${org.name})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
