import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * US-OPS-17 — VoiceOver and TalkBack announce every control with a label
 * and a role. Every touchable in the field app sets `accessibilityRole`,
 * and is named by `accessibilityLabel` or by the text inside it. (The
 * walkthrough on a device is QA section 276; this keeps new controls from
 * slipping through.)
 */
const appRoot = join(__dirname, "../..");
const TOUCHABLE = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "test-utils" || name === "node_modules" ? [] : sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** The opening tag (braces balanced) and, unless it closes itself, the element's children. */
function element(source: string, start: number, name: string): { tag: string; body: string } {
  let i = start;
  let depth = 0;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) break;
  }
  const tag = source.slice(start, i + 1);
  if (tag.endsWith("/>")) return { tag, body: "" };
  const close = source.indexOf(`</${name}>`, i);
  return { tag, body: close === -1 ? "" : source.slice(i + 1, close) };
}

describe("US-OPS-17 · the field app's controls have a label and a role", () => {
  const files = [...sourceFiles(join(appRoot, "app")), ...sourceFiles(join(appRoot, "src"))];

  it("every touchable has accessibilityRole, and accessibilityLabel or text inside it", () => {
    const problems: string[] = [];
    let count = 0;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(TOUCHABLE)) {
        count++;
        const { tag, body } = element(source, match.index!, match[1]!);
        const line = source.slice(0, match.index).split("\n").length;
        const where = `${relative(appRoot, file)}:${line}`;
        if (!/accessibilityRole=|role=/.test(tag)) problems.push(`${where} has no accessibilityRole`);
        if (!/accessibilityLabel=|aria-label=/.test(tag) && !/<Text\b/.test(body)) problems.push(`${where} has no label or text`);
      }
    }
    expect(count).toBeGreaterThan(50);
    expect(problems).toEqual([]);
  });
});
