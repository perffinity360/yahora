#!/usr/bin/env node
// frontend/scripts/check-paste-format.mjs
//
// Runs src/utils/pasteFormat.js's htmlToFormatted on copied HTML from the
// places people paste from (docs/design/TEXT_FORMAT_SPEC.md §4) and fails if
// any comes in wrong:
//
//   npm run check:paste
//
// jsdom stands in for the browser's DOMParser. The "Yahora itself" sample is
// the HTML FormattedText really draws, rendered through Vite (so its CSS
// module and JSX load as they do in the app) and react-dom/server.

import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { window } = new JSDOM("");
globalThis.DOMParser = window.DOMParser;
globalThis.Node = window.Node;

const vite = await createServer({
  root: new URL("..", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
});

let failures = 0;
const show = (s) => JSON.stringify(s);

try {
  const { htmlToFormatted } = await vite.ssrLoadModule("/src/utils/pasteFormat.js");
  const { default: FormattedText } = await vite.ssrLoadModule("/src/components/FormattedText/FormattedText.jsx");

  const yahoraText = "*Hello* everyone\n- first point\n2. second point\n> a _quote_";
  const yahoraHtml = renderToStaticMarkup(createElement("p", null, createElement(FormattedText, { content: yahoraText })));

  // [name, copied HTML, expected text, or null when it must not count as formatted]
  const SAMPLES = [
    [
      "Google Docs",
      '<b style="font-weight:normal" id="docs-internal-guid-1"><p>' +
        '<span style="font-weight:400;white-space:pre;white-space:pre-wrap">Meeting at </span>' +
        '<span style="font-weight:700;white-space:pre-wrap">5 pm</span>' +
        '<span style="font-weight:400;font-style:italic;white-space:pre-wrap"> sharp</span>' +
        "</p></b>",
      "Meeting at *5 pm* _sharp_",
    ],
    [
      "ChatGPT",
      "<p>Here is <strong>bold</strong> and <em>italic</em>.</p>" +
        "<ul><li><p>First</p></li><li><p>Second</p></li></ul>" +
        "<pre><code>const a = 1;\nconsole.log(a);\n</code></pre><p>Done.</p>",
      "Here is *bold* and _italic_.\n- First\n- Second\n```const a = 1;\nconsole.log(a);```\nDone.",
    ],
    ["Yahora itself", yahoraHtml, yahoraText],
    ["plain web text", "<p>Just some text.</p>", null],
    ["bold inside a word", "<p>He<b>llo</b> there</p>", null],
  ];

  for (const [name, html, expected] of SAMPLES) {
    const result = htmlToFormatted(html);
    const ok = expected === null ? result.formatted === false : result.formatted === true && result.text === expected;
    if (ok) {
      console.log(`✓ ${name}`);
    } else {
      failures += 1;
      const want = expected === null ? "formatted: false" : show(expected);
      console.log(`✗ ${name}\n    expected ${want}\n    got      ${show(result.text)} (formatted: ${result.formatted})`);
      if (name === "Yahora itself") console.log(`    HTML     ${yahoraHtml}`);
    }
  }

  console.log(failures ? `\n${failures} of ${SAMPLES.length} samples failed.` : `\nAll ${SAMPLES.length} samples pass.`);
} finally {
  await vite.close();
}

process.exit(failures ? 1 : 0);
