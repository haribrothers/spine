import "reflect-metadata";
import "./openapi-env";
import { writeFileSync } from "node:fs";
import { RequestMethod, type Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { CAPABILITY_LABELS, type Capability } from "@spine/shared";
import { AppModule } from "../app.module";
import { CAPABILITY_KEY } from "../auth/require-capability.decorator";
import { spineVersion } from "../common/version";

/** The statuses every route can answer with, from 05-api's conventions. */
const ERRORS: Record<string, string> = {
  "400": "Validation failed or a business rule was broken; `message` says what to change.",
  "401": "No session, or it has expired: sign in again.",
  "403": "The caller's role, Team rights or ownership don't allow it, the module is switched off, or their access was removed.",
  "404": "No such record in this business.",
  "409": "The same Idempotency-Key is still being handled, or the record conflicts with one that exists.",
  "429": "Too many requests: wait a minute.",
  "500": "Something went wrong on the server; the response carries the request id to report.",
};
const WRITES = new Set(["post", "put", "patch", "delete"]);
const ROLE_NAMES: Record<string, string> = { owner: "Owners", staff: "Staff", field: "Field users" };

interface RouteRules {
  roles?: string[];
  capability?: Capability;
  public?: boolean;
}

/** Every controller's routes and who may call them, keyed by Swagger's operationId (`Controller_method`). */
function routeRules(root: Type): Map<string, RouteRules> {
  const rules = new Map<string, RouteRules>();
  const seen = new Set<unknown>();
  const visit = (entry: unknown) => {
    const mod = (entry as { module?: Type })?.module ?? (entry as Type);
    if (!mod || seen.has(mod)) return;
    seen.add(mod);
    for (const imported of [...(Reflect.getMetadata("imports", mod) ?? []), ...((entry as { imports?: unknown[] }).imports ?? [])]) visit(imported);
    for (const controller of (Reflect.getMetadata("controllers", mod) ?? []) as Type[]) {
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (name === "constructor" || typeof handler !== "function" || Reflect.getMetadata("method", handler) === undefined) continue;
        const read = <T>(key: string): T | undefined => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller);
        rules.set(`${controller.name}_${name}`, { roles: read<string[]>("ORG_ROLES"), capability: read<Capability>(CAPABILITY_KEY), public: read<boolean>("PUBLIC") });
      }
    }
  };
  visit(root);
  return rules;
}

/** "issueInvoice" → "Issue invoice". */
const sentence = (name: string) => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * US-SITE-10 — what the API reference shows beyond Nest's own document: a
 * summary, who may call each route (role and Team right), the
 * Idempotency-Key header on writes, every error status and a curl example.
 */
function enrich(document: OpenAPIObject, rules: Map<string, RouteRules>): OpenAPIObject {
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, op] of Object.entries(item) as [string, Record<string, unknown>][]) {
      if (!op || typeof op !== "object" || !("responses" in op)) continue;
      const operationId = String(op.operationId ?? "");
      const rule = rules.get(operationId) ?? {};
      op.summary ??= sentence(operationId.split("_")[1] ?? method);
      const who = rule.public
        ? "Anyone, without signing in."
        : [
            rule.roles?.length ? rule.roles.map((r) => ROLE_NAMES[r] ?? r).join(", ").replace(/, ([^,]*)$/, " and $1") + "." : "Any signed-in member of the business.",
            rule.capability ? `Staff need the Team right **${CAPABILITY_LABELS[rule.capability]?.label ?? rule.capability}** (\`${rule.capability}\`).` : "",
          ]
            .filter(Boolean)
            .join(" ");
      const write = WRITES.has(method);
      const curl = [
        `curl -X ${method.toUpperCase()} "https://spine.example.com/api${path.replace(/\{(\w+)\}/g, "<$1>")}"`,
        rule.public ? null : `  -H "Cookie: better-auth.session_token=<session>"`,
        write ? `  -H "Idempotency-Key: $(uuidgen)"` : null,
        write && method !== "delete" ? `  -H "Content-Type: application/json" -d '{ … }'` : null,
      ].filter(Boolean).join(" \\\n");
      op.description = [op.description, `**Who can call it:** ${who}`, "```sh\n" + curl + "\n```"].filter(Boolean).join("\n\n");
      if (write) {
        const params = (op.parameters as unknown[] | undefined) ?? [];
        params.push({ name: "Idempotency-Key", in: "header", required: true, description: "A fresh UUID per action. A retry with the same key gets the first answer instead of doing it twice.", schema: { type: "string", format: "uuid" } });
        op.parameters = params;
      }
      const responses = op.responses as Record<string, unknown>;
      for (const [status, meaning] of Object.entries(ERRORS)) {
        if (status === "401" && rule.public) continue;
        responses[status] ??= { description: meaning };
      }
    }
  }
  return document;
}

/**
 * US-SITE-10 — writes the API's OpenAPI document, for the docs site's
 * generated API reference (and anyone else), without starting the API:
 * NestJS's preview mode reads the routes' metadata and creates nothing, so
 * no database is needed.
 *   node dist/scripts/openapi.js <file>
 */
async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Pass the file to write, e.g. ../docs/openapi.json");
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Spine API")
      .setDescription("The REST API behind Spine's web app and field app. Every route is under /api on your Spine's address.")
      .setVersion(spineVersion())
      .addCookieAuth("better-auth.session_token")
      .addBearerAuth()
      .build(),
  );
  writeFileSync(out, `${JSON.stringify(enrich(document, routeRules(AppModule)), null, 2)}\n`);
  await app.close();
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
