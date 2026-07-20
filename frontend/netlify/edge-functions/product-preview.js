/**
 * Yahora — product link preview (Open Graph) edge function
 * File: frontend/netlify/edge-functions/product-preview.js
 *
 * WHY THIS EXISTS
 * ---------------
 * Yahora is a client-side SPA: index.html is a static shell and every product
 * page is rendered by React in the browser. Link-preview crawlers (WhatsApp,
 * iMessage, Slack, Twitter, Facebook) do NOT execute JavaScript — they fetch
 * the URL, read the <head>, and leave. So react-helmet, document.title, and
 * useEffect-injected <meta> tags are all invisible to them, and every shared
 * product produced the same generic "Yahora" card.
 *
 * This runs at the CDN edge in front of /product/*, fetches the product's
 * public metadata, and injects real og:* tags into the HTML before it is sent.
 * The SPA still boots exactly as before — the tags are inert for real users.
 *
 * SAFETY: any failure (bad id, API down, timeout, non-HTML) returns the
 * original response untouched. A broken preview must never break the page.
 */

const API_TIMEOUT_MS = 2000;
const DESCRIPTION_MAX = 200;

/** Escape for use inside a double-quoted HTML attribute. Product titles and
 *  descriptions are user-generated, so this is an injection boundary. */
function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(text, max) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function formatPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  // Crawlers read plain text; keep the Indian grouping the UI uses.
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function productPreview(request, context) {
  const response = await context.next();

  // Only rewrite the SPA shell.
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const apiBase = Netlify.env.get("VITE_API_BASE_URL");
  if (!apiBase) {
    console.warn("[product-preview] VITE_API_BASE_URL is not set; skipping.");
    return response;
  }

  const url = new URL(request.url);
  const id = url.pathname.split("/").filter(Boolean)[1];
  if (!id) return response;

  let product;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const apiRes = await fetch(
      `${apiBase.replace(/\/+$/, "")}/api/products/${encodeURIComponent(id)}/meta`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    clearTimeout(timer);

    if (!apiRes.ok) return response;
    ({ product } = await apiRes.json());
  } catch (err) {
    console.warn(`[product-preview] lookup failed for ${id}:`, err?.message);
    return response;
  }

  if (!product?.title) return response;

  const price = formatPrice(product.price);
  const pageUrl = `${url.origin}/product/${product.id}`;

  const title = price
    ? `${product.title} — ${price} | Yahora`
    : `${product.title} | Yahora`;

  // Prefer the seller's own words; fall back to something specific, never generic.
  const descriptionParts = [];
  if (product.condition) descriptionParts.push(`${product.condition} condition`);
  if (product.university_name) descriptionParts.push(product.university_name);
  if (product.seller_name) descriptionParts.push(`Listed by ${product.seller_name}`);

  const description = truncate(
    product.description?.trim() ||
      `${descriptionParts.join(" · ")}. Buy and sell with verified students on Yahora.`,
    DESCRIPTION_MAX,
  );

  /* og:image must be an absolute, publicly reachable URL — relative paths and
     LAN/localhost addresses render as a blank card. */
  const image =
    product.image && /^https?:\/\//i.test(product.image) ? product.image : null;

  const tags = [
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}" />`,
    `<link rel="canonical" href="${escapeAttr(pageUrl)}" />`,

    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="Yahora" />`,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}" />`,

    image ? `<meta property="og:image" content="${escapeAttr(image)}" />` : "",
    image ? `<meta property="og:image:secure_url" content="${escapeAttr(image)}" />` : "",
    image ? `<meta property="og:image:alt" content="${escapeAttr(product.title)}" />` : "",
    // WhatsApp renders the large card far more reliably when dimensions are declared.
    image ? `<meta property="og:image:width" content="1200" />` : "",
    image ? `<meta property="og:image:height" content="630" />` : "",

    price ? `<meta property="product:price:amount" content="${escapeAttr(product.price)}" />` : "",
    price ? `<meta property="product:price:currency" content="INR" />` : "",
    product.status
      ? `<meta property="product:availability" content="${product.status === "sold" ? "oldout" : "instock"}" />`
      : "",

    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    image ? `<meta name="twitter:image" content="${escapeAttr(image)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  const html = await response.text();

  /* Drop the shell's static <title> and any placeholder og:* tags first, so
     crawlers that take the FIRST match don't read the generic ones. */
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+property="og:[\s\S]*?"\s*\/?>/gi, "")
    .replace(/<meta\s+name="twitter:[\s\S]*?"\s*\/?>/gi, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/?>/i, "");

  /* Inject AFTER the charset declaration, not straight after <head>. These tags
     carry non-ASCII (₹, —) and the spec wants charset inside the first 1024
     bytes; pushing it down risks mojibake in crawlers that ignore the header. */
  const charsetTag = stripped.match(/<meta\s+charset=[^>]*>/i);
  const rewritten = charsetTag
    ? stripped.replace(charsetTag[0], `${charsetTag[0]}\n    ${tags}`)
    : stripped.replace(/<head([^>]*)>/i, `<head$1>\n    ${tags}`);

  return new Response(rewritten, {
    status: response.status,
    headers: response.headers,
  });
}

export const config = { path: "/product/*" };
