import { formatMoney } from "@spine/shared";
import type { SendEmailInput } from "./email.service";

/**
 * US-NTF-10 (D-067) — the one layout every Spine email uses: a 6px bar in
 * the document colour, the logo and business name, a heading, a short
 * body, an optional key-facts box, at most one button, and the business
 * footer. Emails stay light (CLAUDE.md), so the colours are the light
 * values from docs/design/tokens.json, inlined because email clients
 * ignore stylesheets.
 */
export const EMAIL_COLORS = {
  primary: "#2954E5",
  onPrimary: "#FFFFFF",
  canvas: "#F2F1EE",
  surface: "#FFFFFF",
  sunken: "#FAFAF9",
  border: "#E7E5E0",
  text: "#211F1A",
  muted: "#726C5A",
} as const;

export const EMAIL_LOGO_CID = "logo@spine";

export interface EmailBrand {
  name: string;
  /** Document colour, `#RRGGBB`. */
  color: string;
  logo?: { content: Buffer; contentType: string };
  /** "Riverstone Builders · 14 Harbour Road, Marina District" */
  footer: string;
  /** For money in the email (Settings › Currency & locale). */
  locale?: string;
  /** The organisation's currency, for sample emails (US-SET-22). */
  currency?: string;
}

export interface EmailContent {
  /** Hidden preview line shown by inbox lists. */
  preheader?: string;
  heading: string;
  /** "Hi Alan," */
  greeting?: string;
  paragraphs: string[];
  facts?: { label: string; value: string }[];
  /** Short titled lists under the facts, e.g. the digest's "Today" and "Yesterday" (US-NTF-13). */
  sections?: { title: string; lines: string[] }[];
  /** A block shown above the button, e.g. payment instructions. Line breaks are kept. */
  callout?: { title: string; body: string };
  button?: { label: string; url: string };
  /** Small print under the button. */
  note?: string;
  /** Extra footer line, e.g. "You're getting this because you're a member of <Business>." */
  footerNote?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  attachments: NonNullable<SendEmailInput["attachments"]>;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Escaped text with line breaks kept and web addresses made clickable (D-153). */
function multiline(value: string): string {
  return escapeHtml(value)
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, (url) => `<a href="${url}" style="color:inherit;text-decoration:underline;">${url}</a>`)
    .replace(/\r?\n/g, "<br>");
}

/** "Alan" from "Alan Brooks"; "there" when there's no name. */
export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

export function renderEmail(brand: EmailBrand, content: EmailContent): RenderedEmail {
  const c = EMAIL_COLORS;
  const color = HEX.test(brand.color) ? brand.color : c.primary;
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const logo = brand.logo
    ? `<td style="padding-right:12px;vertical-align:middle;"><img src="cid:${EMAIL_LOGO_CID}" alt="${escapeHtml(brand.name)}" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:8px;object-fit:contain;"></td>`
    : "";
  const facts = content.facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${c.border};border-radius:8px;margin:0 0 20px;">${content.facts
        .map(
          (f) =>
            `<tr><td style="padding:6px 16px;color:${c.muted};font-size:14px;">${escapeHtml(f.label)}</td><td align="right" style="padding:6px 16px;color:${c.text};font-size:14px;font-weight:600;">${escapeHtml(f.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const sections = (content.sections ?? [])
    .filter((s) => s.lines.length > 0)
    .map(
      (s) =>
        `<p style="margin:0 0 4px;color:${c.text};font-size:15px;font-weight:600;">${escapeHtml(s.title)}</p><p style="margin:0 0 16px;color:${c.text};font-size:15px;line-height:1.6;">${s.lines.map(escapeHtml).join("<br>")}</p>`,
    )
    .join("\n");
  const callout = content.callout
    ? `<div style="background:${c.sunken};border:1px solid ${c.border};border-radius:8px;padding:12px 16px;margin:0 0 20px;"><p style="margin:0 0 4px;color:${c.text};font-size:14px;font-weight:600;">${escapeHtml(content.callout.title)}</p><p style="margin:0;color:${c.text};font-size:14px;line-height:1.5;">${multiline(content.callout.body)}</p></div>`
    : "";
  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="border-radius:8px;background:${color};"><a href="${escapeHtml(content.button.url)}" style="display:inline-block;padding:11px 22px;color:${c.onPrimary};font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(content.button.label)}</a></td></tr></table>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.heading)}</title></head>
<body style="margin:0;padding:0;background:${c.canvas};${font};">
${content.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.canvas};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${c.surface};border:1px solid ${c.border};border-radius:8px;border-top:6px solid ${color};">
<tr><td style="padding:28px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>${logo}<td style="vertical-align:middle;color:${c.text};font-size:18px;font-weight:600;">${escapeHtml(brand.name)}</td></tr></table>
<h1 style="margin:0 0 16px;color:${c.text};font-size:24px;line-height:1.3;">${escapeHtml(content.heading)}</h1>
${content.greeting ? `<p style="margin:0 0 4px;color:${c.text};font-size:15px;line-height:1.6;">${escapeHtml(content.greeting)}</p>` : ""}
${content.paragraphs.map((p) => `<p style="margin:0 0 16px;color:${c.text};font-size:15px;line-height:1.6;">${multiline(p)}</p>`).join("\n")}
${facts}${sections}${callout}${button}
${content.note ? `<p style="margin:0 0 20px;color:${c.muted};font-size:13px;line-height:1.5;">${multiline(content.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 32px;background:${c.sunken};border-top:1px solid ${c.border};border-radius:0 0 8px 8px;color:${c.muted};font-size:12px;line-height:1.5;">${escapeHtml(brand.footer)}${content.footerNote ? `<br>${escapeHtml(content.footerNote)}` : ""}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    brand.name,
    "",
    content.heading,
    "",
    ...(content.greeting ? [content.greeting] : []),
    ...content.paragraphs.flatMap((p) => [p, ""]),
    ...(content.facts?.length ? [...content.facts.map((f) => `${f.label}: ${f.value}`), ""] : []),
    ...(content.sections ?? []).filter((s) => s.lines.length > 0).flatMap((s) => [`${s.title}:`, ...s.lines, ""]),
    ...(content.callout ? [`${content.callout.title}:`, content.callout.body, ""] : []),
    ...(content.button ? [`${content.button.label}: ${content.button.url}`, ""] : []),
    ...(content.note ? [content.note, ""] : []),
    "--",
    brand.footer,
    ...(content.footerNote ? [content.footerNote] : []),
  ].join("\n");

  const attachments: RenderedEmail["attachments"] = brand.logo
    ? [{ filename: "logo", content: brand.logo.content, contentType: brand.logo.contentType, cid: EMAIL_LOGO_CID }]
    : [];
  return { html, text, attachments };
}

/** "$1,510.00" in the organisation's locale (US-OPS-24, D-089). */
export function emailMoney(amountMinor: bigint, currency: string, locale = "en-US"): string {
  return formatMoney(amountMinor, currency, locale);
}

/** "17 Oct 2026" */
export function emailDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function appUrl(path: string): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}
