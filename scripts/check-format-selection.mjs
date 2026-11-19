#!/usr/bin/env node
// scripts/check-format-selection.mjs
//
// The typing tools' wrap / unwrap rules (TEXT_FORMAT_SPEC §5.2, §5.5), on the
// website and in the app, which must agree:
//
//   website  frontend/src/utils/formatSelection.js   planFormat
//   app      mobile/src/components/FormatToolbar.tsx applyFormat (the part
//            between "BEGIN format rules" and "END format rules", run here
//            without React Native)
//
// Each case: the text with the selection marked [like this], the button, and
// the text and selection expected after it. Run: node scripts/check-format-selection.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const { planFormat } = await import(pathToFileURL(join(root, "frontend/src/utils/formatSelection.js")));

// The app's rules, cut out of FormatToolbar.tsx and run with Node's own
// TypeScript support, against the app's textFormat.ts.
const toolbar = readFileSync(join(root, "mobile/src/components/FormatToolbar.tsx"), "utf8");
const begin = toolbar.indexOf("// BEGIN format rules");
const end = toolbar.indexOf("// END format rules");
if (begin < 0 || end < 0) throw new Error("FormatToolbar.tsx: the BEGIN / END format rules markers are missing");
const dir = mkdtempSync(join(tmpdir(), "format-selection-"));
const appFile = join(dir, "rules.ts");
const textFormat = pathToFileURL(join(root, "mobile/src/lib/textFormat.ts")).href;
writeFileSync(
  appFile,
  `import { formatSpans } from ${JSON.stringify(textFormat)};\n` +
    toolbar.slice(begin, end),
);
let appApply;
try {
  ({ applyFormat: appApply } = await import(pathToFileURL(appFile)));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

/* "big [exam] day" → { value: "big exam day", start: 4, end: 8 } */
function parse(marked) {
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  return { value: marked.replace("[", "").replace("]", ""), start, end };
}
function show(value, start, end) {
  return `${value.slice(0, start)}[${value.slice(start, end)}]${value.slice(end)}`;
}

const CASES = [
  // Plain wrap and unwrap, as before.
  ["[exam]", "bold", "*[exam]*"],
  ["*[exam]*", "bold", "[exam]"],
  ["[*exam*]", "bold", "[exam]"],
  ["**[exam]**", "bold", "[exam]"],
  ["[ exam ]", "italic", " _[exam]_ "],
  ["[- one\n- two]", "bold", "- *[one*\n- *two]*"],
  ["[a\nb]", "mono", "```[a\nb]```"],
  ["[*a*\nb]", "bold", "*[a*\n*b]*"],
  // Code then strike: the ~ goes OUTSIDE the backticks, and comes off again.
  ["[exam]", "code", "`[exam]`"],
  ["`[exam]`", "strike", "~`[exam]`~"],
  ["~`[exam]`~", "strike", "`[exam]`"],
  ["`[exam]`", "code", "[exam]"],
  ["[`exam`]", "strike", "~[`exam`]~"],
  ["`[exa]m`", "bold", "*`[exa]m`*"],
  ["big `ex[am` d]ay", "italic", "big _`ex[am` d]_ay"],
  // Monospace: on, off, and code ↔ monospace switch instead of nesting.
  ["[The]", "mono", "```[The]```"],
  ["```[The]```", "mono", "[The]"],
  ["`[The]`", "mono", "```[The]```"],
  ["```[The]```", "code", "`[The]`"],
  ["[```The```]", "mono", "[The]"],
  // Code over text that has code inside: the inner markers go.
  ["[a `b` c]", "code", "`[a b c]`"],
  // Bold never crosses a line: inside multi-line monospace it does nothing.
  ["```[a]\nb```", "bold", "```[a]\nb```"],
];

let failed = 0;
for (const [input, kind, expected] of CASES) {
  const { value, start, end } = parse(input);
  const plan = planFormat(value, start, end, kind);
  const web = plan
    ? show(value.slice(0, plan.from) + plan.text + value.slice(plan.to), plan.selStart, plan.selEnd)
    : show(value, start, end);
  const out = appApply(value, { start, end }, kind);
  const app = show(out.value, out.selection.start, out.selection.end);
  for (const [who, got] of [
    ["website", web],
    ["app", app],
  ]) {
    if (got !== expected) {
      failed += 1;
      console.log(`✗ ${who}: ${JSON.stringify(input)} + ${kind} → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    }
  }
}

if (failed) {
  console.log(`\n${failed} failed.`);
  process.exit(1);
}
console.log(`✓ All ${CASES.length} cases pass on the website and the app.`);
