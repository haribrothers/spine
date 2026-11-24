import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * US-OPS-21 — no text the web app shows carries a legacy story id such as
 * "(S-03.11)". Only strings and JSX text count; comments may keep them.
 */
const webSrc = path.resolve(__dirname, "../../../web/src");
const STORY_ID = /\(S-\d{2}\.\d+\)/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(full) ? [full] : [];
  });
}

function shownText(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      found.push(node.text);
    } else if (ts.isJsxText(node)) {
      found.push(node.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("US-OPS-21 · no legacy story ids in the interface", () => {
  it("no string or JSX text under apps/web/src matches (S-NN.N)", () => {
    const offenders = files(webSrc).flatMap((file) => shownText(file).filter((t) => STORY_ID.test(t)).map((t) => `${path.relative(webSrc, file)}: ${t.trim().slice(0, 80)}`));
    expect(offenders).toEqual([]);
  });

  it("the scan does catch one", () => {
    const tmp = ts.createSourceFile("x.tsx", 'const a = <p helper="Drives the overdue flag (S-05.9)">x</p>;', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const texts: string[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isStringLiteral(n)) texts.push(n.text);
      ts.forEachChild(n, visit);
    };
    visit(tmp);
    expect(texts.some((t) => STORY_ID.test(t))).toBe(true);
  });
});
