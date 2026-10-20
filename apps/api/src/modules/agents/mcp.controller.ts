import { Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../../auth/auth";
import { McpService } from "./mcp.service";

/** An Express request as a Fetch `Request` (the body Nest already parsed goes back as JSON). */
export function toFetchRequest(req: ExpressRequest): Request {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {})) : undefined;
  if (hasBody) headers.delete("content-length");
  return new Request(url, { method: req.method, headers, body });
}

/** A Fetch `Response` written back through Express. */
export async function sendFetchResponse(res: ExpressResponse, response: Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}

/**
 * US-MCP-03 (D-258) — `/mcp`, Streamable HTTP, stateless: POST only. It's
 * public to the session guards because agents send their own Bearer token,
 * which `McpService` checks. No Idempotency-Key: draft tools derive their
 * own (US-MCP-07).
 */
@Controller("mcp")
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  @AllowAnonymous()
  async post(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    await sendFetchResponse(res, await this.mcp.handle(toFetchRequest(req)));
  }

  @Get()
  @AllowAnonymous()
  @HttpCode(405)
  notAllowed(@Res() res: ExpressResponse) {
    res.setHeader("Allow", "POST");
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Use POST." }, id: null });
  }
}

const betterAuthHandler = toNodeHandler(auth);

/**
 * US-MCP-03 — OAuth discovery at the root, where agents look for it
 * (RFC 9728, RFC 8414 path insertion): Better Auth's MCP provider answers
 * both from its own handler. Caddy routes `/.well-known/oauth-*` here.
 */
@Controller(".well-known")
export class WellKnownController {
  @Get(["oauth-protected-resource", "oauth-protected-resource/*path", "oauth-authorization-server", "oauth-authorization-server/*path", "openid-configuration", "openid-configuration/*path"])
  @AllowAnonymous()
  async discovery(@Req() req: ExpressRequest, @Res() res: ExpressResponse) {
    await betterAuthHandler(req, res);
  }
}
