#!/usr/bin/env node
// scripts/check-text-format.mjs
//
// Runs the website's and the app's text formatter against the same cases
// (docs/design/TEXT_FORMAT_SPEC.md) and fails if either gets one wrong, or if
// the two ever disagree:
//
//   node scripts/check-text-format.mjs
//
// frontend/src/utils/textFormat.js and mobile/src/lib/textFormat.ts are kept
// line for line the same. Node (22.18+, 23.6+) runs the TypeScript one as it
// is, which is why that file imports nothing.
//
// Each expected value is the formatted text written as markup, so a case reads
// at a glance: <b> bold, <i> italic, <s> strike, <mono> and <code>, <a> a link
// (with its href only where it differs from the text), and one line per "|",
// a bullet as [•], a numbered item as [1.], a quote as [>].

// mobile/package.json has no "type" (Expo doesn't want one), so Node notes
// that it read the .ts file as a module. That's expected; keep the output clean.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const code = typeof rest[0] === "object" ? rest[0]?.code : rest[1];
  if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
  emitWarning.call(process, warning, ...rest);
};

const web = await import("../frontend/src/utils/textFormat.js");
const app = await import("../mobile/src/lib/textFormat.ts");

const CASES = [
  // The four WhatsApp symbols, and code.
  ["*bold*", "<b>bold</b>"],
  ["_italic_", "<i>italic</i>"],
  ["~strike~", "<s>strike</s>"],
  ["```mono```", "<mono>mono</mono>"],
  ["`code`", "<code>code</code>"],
  ["*bold* and _italic_ and ~gone~", "<b>bold</b> and <i>italic</i> and <s>gone</s>"],
  ["*_both_*", "<b><i>both</i></b>"],
  ["_*both*_", "<i><b>both</b></i>"],
  ["*bold with _italic_ inside*", "<b>bold with <i>italic</i> inside</b>"],
  ["(*bold*)", "(<b>bold</b>)"],
  ["*bold*.", "<b>bold</b>."],
  ["*😀*", "<b>😀</b>"],
  ["*नमस्ते*", "<b>नमस्ते</b>"],
  ["*a* b*", "<b>a</b> b*"],
  ["_a_b_", "<i>a_b</i>"],

  // Not formatting: inside a word, next to a space, empty, alone.
  ["snake_case_name", "snake_case_name"],
  ["2*3*4", "2*3*4"],
  ["a * b * c", "a * b * c"],
  ["*not bold *", "*not bold *"],
  ["hello*world*", "hello*world*"],
  ["*hello*world", "*hello*world"],
  ["नमस्ते*बोल्ड*", "नमस्ते*बोल्ड*"],
  ["café_crème_", "café_crème_"],
  ["john_doe@mail.com", "john_doe@mail.com"],
  ["*", "*"],
  ["**", "**"],
  ["_", "_"],
  ["~~", "~~"],
  ["*line one\nline two*", "*line one|line two*"],

  // Code and monospace: nothing inside is formatted.
  ["`a*b*c`", "<code>a*b*c</code>"],
  ["```*not bold*```", "<mono>*not bold*</mono>"],
  ["*a `b*` c*", "<b>a <code>b*</code> c</b>"],
  ["```a\nb```", "<mono>a\nb</mono>"],
  ["x ```a\nb``` y", "x <mono>a\nb</mono> y"],
  ["```unclosed", "```unclosed"],
  ["`unclosed", "`unclosed"],
  ["a```b```", "a```b```"],
  ["``", "``"],
  ["```   ```", "```   ```"],

  // Links: found first, and never formatted inside.
  ["https://example.com/some_path_here", "<a>https://example.com/some_path_here</a>"],
  ["https://x.com/_foo_", "<a>https://x.com/_foo_</a>"],
  ["_https://x.com/_foo_", "<i><a>https://x.com/_foo</a></i>"],
  ["*https://x.com*", "<b><a>https://x.com</a></b>"],
  ["*_https://x.com_*", "<b><i><a>https://x.com</a></i></b>"],
  ["*https://x.com_*", "<b><a>https://x.com_</a></b>"],
  ["see www.example.com.", "see <a href=https://www.example.com>www.example.com</a>."],
  ["(see https://x.com/a)", "(see <a>https://x.com/a</a>)"],
  ["https://en.wikipedia.org/wiki/Foo_(bar)", "<a>https://en.wikipedia.org/wiki/Foo_(bar)</a>"],
  ["http://x.com/*a*", "<a>http://x.com/*a*</a>"],
  ["`https://x.com`", "<code>https://x.com</code>"],

  // Lines.
  ["one\ntwo", "one|two"],
  ["one\n\ntwo", "one||two"],
  ["hi\n", "hi"],
  ["- one\n- two", "[•]one|[•]two"],
  ["* one\n* two", "[•]one|[•]two"],
  ["* not bold*", "[•]not bold*"],
  ["1. first\n2. *second*", "[1.]first|[2.]<b>second</b>"],
  ["10. ten", "[10.]ten"],
  ["> quoted *bold*", "[>]quoted <b>bold</b>"],
  ["- ", "- "],
  ["> ", "> "],
  [">quote", ">quote"],
  ["-1 degrees", "-1 degrees"],
  ["1.5 is a number", "1.5 is a number"],
  ["text\n- item\nmore", "text|[•]item|more"],
];

const PLAIN = [
  ["*bold* and _italic_", "bold and italic"],
  ["- one\n- two", "• one\n• two"],
  ["1. one", "1. one"],
  ["> quoted", "quoted"],
  ["```code```", "code"],
  ["see https://x.com/_a_", "see https://x.com/_a_"],
  ["no symbols here", "no symbols here"],
  ["*unclosed", "*unclosed"],
];

function markup(nodes) {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return n.text;
        case "bold":
          return `<b>${markup(n.children)}</b>`;
        case "italic":
          return `<i>${markup(n.children)}</i>`;
        case "strike":
          return `<s>${markup(n.children)}</s>`;
        case "mono":
          return `<mono>${n.text}</mono>`;
        case "code":
          return `<code>${n.text}</code>`;
        case "link":
          return n.href === n.text ? `<a>${n.text}</a>` : `<a href=${n.href}>${n.text}</a>`;
        default:
          return `<?${n.type}>`;
      }
    })
    .join("");
}

function render(lines) {
  return lines
    .map((line) => {
      const lead = line.kind === "bullet" ? "[•]" : line.kind === "number" ? `[${line.marker}]` : line.kind === "quote" ? "[>]" : "";
      return lead + markup(line.nodes);
    })
    .join("|");
}

let failures = 0;
const show = (s) => JSON.stringify(s);

for (const [input, expected] of CASES) {
  const fromWeb = render(web.parseFormatted(input));
  const fromApp = render(app.parseFormatted(input));
  if (fromWeb !== expected || fromApp !== expected) {
    failures += 1;
    console.log(`✗ ${show(input)}\n    expected ${show(expected)}\n    website  ${show(fromWeb)}\n    app      ${show(fromApp)}`);
  }
}

for (const [input, expected] of PLAIN) {
  const fromWeb = web.plainText(input);
  const fromApp = app.plainText(input);
  if (fromWeb !== expected || fromApp !== expected) {
    failures += 1;
    console.log(`✗ plainText ${show(input)}\n    expected ${show(expected)}\n    website  ${show(fromWeb)}\n    app      ${show(fromApp)}`);
  }
}

const total = CASES.length + PLAIN.length;
if (failures) {
  console.log(`\n${failures} of ${total} cases failed.`);
  process.exit(1);
}
console.log(`✓ All ${total} cases pass on the website and the app.`);
