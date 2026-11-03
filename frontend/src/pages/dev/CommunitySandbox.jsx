// frontend/src/pages/dev/CommunitySandbox.jsx
//
// ⚠ DEVELOPMENT ONLY — /dev/community. App.jsx registers this route only when
// import.meta.env.DEV is true and loads it with React.lazy, so it never
// reaches the production build (check: `ls dist/assets | grep -i sandbox`
// prints nothing).
//
// A bench for the Block N-S pieces before the posts API exists: the composer,
// the GIF picker and the report form, each with sample onSubmit handlers
// that answer with every result of spec §2.3 and §7. No calls to our API;
// the GIF picker talks to KLIPY for real.
//
// Self-contained on purpose: it doesn't import pages/community/sampleData.js,
// which part 2 (CC-N4b) deletes.

import React, { useRef, useState } from "react";
import Composer from "../../components/community/Composer/Composer";
import GifPicker from "../../components/community/GifPicker/GifPicker";
import ReportModal from "../../components/community/ReportModal/ReportModal";
import AppToast, { useToast } from "../../components/AppToast/AppToast";
import { REPORT_TEXT } from "../../hooks/useReport";
import styles from "./CommunitySandbox.module.css";

const VIEWER = {
  username: "arjun.mehta",
  name: "Arjun Mehta",
  campus: "IIITDM Kurnool",
  avatar: null,
};

const SAMPLE_POST_ID = "p0000000-0000-0000-0000-000000000001";
const DELAY_MS = 700;
const wait = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

/* What the sample POST /api/posts answers, per button (spec §2.3 and
   runbook Appendix A). */
const POST_RESULTS = [
  ["posted", "Posted"],
  ["nudge", "Nudge"],
  ["held", "Held"],
  ["support", "Held + support"],
  ["rate", "Rate-limited"],
  ["not-allowed", "Not allowed"],
  ["network", "Network error"],
];

const FEEDS = [
  ["campus", "Campus"],
  ["country", "India"],
  ["global", "Global"],
];

/* Turn the sent FormData into something readable on the page. */
function describeForm(form, options) {
  const out = {};
  for (const [key, value] of form.entries()) {
    const shown = value instanceof File ? `${value.name} (${Math.round(value.size / 1024)} KB)` : value;
    out[key] = key in out ? [].concat(out[key], shown) : shown;
  }
  return { ...out, _options: options };
}

export default function CommunitySandbox() {
  const [feed, setFeed] = useState("campus");
  const [reply, setReply] = useState(false);
  const [postResult, setPostResult] = useState("posted");
  const [lastSent, setLastSent] = useState(null);
  const [picked, setPicked] = useState(null);
  const [gifOpen, setGifOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportResult, setReportResult] = useState("sent");
  const [lastReport, setLastReport] = useState(null);
  const { toast, showToast } = useToast();
  // Read inside the handlers, so a button pressed while the dialog is open
  // still decides the next answer.
  const postResultRef = useRef(postResult);
  postResultRef.current = postResult;

  const samplePost = async (form, options) => {
    setLastSent(describeForm(form, options));
    await wait();
    const result = postResultRef.current;
    const post = { id: crypto.randomUUID(), content: form.get("content") };
    // A nudge re-sent with confirm=true posts, as the real API does.
    if (result === "nudge" && options.confirm) return { status: 201, body: { post } };
    switch (result) {
      case "posted":
        return { status: 201, body: { post } };
      case "nudge":
        return { status: 422, body: { error: "MODERATION_NUDGE", categories: ["harassment"] } };
      case "held":
        return { status: 202, body: { post, held: true, support: false } };
      case "support":
        return { status: 202, body: { post, held: true, support: true } };
      case "rate":
        return { status: 429, body: { error: reply ? "RATE_LIMIT_REPLIES" : "RATE_LIMIT_POSTS" } };
      case "not-allowed":
        return { status: 403, body: { error: "NOT_ALLOWED_HERE" } };
      default:
        throw new TypeError("Failed to fetch");
    }
  };

  const sampleReport = async (body) => {
    setLastReport(body);
    await wait();
    return reportResult === "sent"
      ? { status: 201, body: { reported: true } }
      : { status: 400, body: { error: "DUPLICATE" } };
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Community sandbox</h1>
      <p className={styles.note}>
        Development only. Sample answers, no calls to our API. The GIF picker uses KLIPY.
      </p>

      {/* ── Composer ──────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2>Composer</h2>
        <div className={styles.row}>
          <span className={styles.label}>Feed</span>
          {FEEDS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.pill} ${feed === value ? styles.pillOn : ""}`}
              aria-pressed={feed === value}
              onClick={() => setFeed(value)}
            >
              {label}
            </button>
          ))}
          <label className={styles.toggle}>
            <input type="checkbox" checked={reply} onChange={(e) => setReply(e.target.checked)} />
            Reply
          </label>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Next answer</span>
          {POST_RESULTS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.pill} ${postResult === value ? styles.pillOn : ""}`}
              aria-pressed={postResult === value}
              onClick={() => setPostResult(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.stage}>
          {/* Kept mounted across feed changes, so the open composer's chip and
              grey text follow the switch (they come straight from props).
              Remounted only for reply, which changes what the composer is. */}
          <Composer
            key={reply ? "reply" : "post"}
            feed={feed}
            countryName="India"
            viewer={VIEWER}
            parentId={reply ? SAMPLE_POST_ID : null}
            replyToUsername={reply ? "rahul.verma" : undefined}
            onSubmit={samplePost}
            onPosted={(post) => showToast(`Posted: ${post.id.slice(0, 8)}…`)}
          />
        </div>
        {lastSent && (
          <pre className={styles.output} aria-label="Last form sent">
            {JSON.stringify(lastSent, null, 2)}
          </pre>
        )}
      </section>

      {/* ── GIF picker ────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2>GIF picker</h2>
        {gifOpen ? (
          <GifPicker
            onPick={(gif) => setPicked(gif)}
            onClose={() => setGifOpen(false)}
          />
        ) : (
          <button type="button" className={styles.pill} onClick={() => setGifOpen(true)}>
            Open the GIF picker
          </button>
        )}
        {picked && (
          <div className={styles.picked}>
            <img src={picked.preview_url} alt="Picked GIF" />
            <pre className={styles.output}>{JSON.stringify(picked, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* ── Report form ───────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2>Report form</h2>
        <div className={styles.row}>
          <span className={styles.label}>Next answer</span>
          {[
            ["sent", "Sent"],
            ["duplicate", "Already reported"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.pill} ${reportResult === value ? styles.pillOn : ""}`}
              aria-pressed={reportResult === value}
              onClick={() => setReportResult(value)}
            >
              {label}
            </button>
          ))}
          <button type="button" className={styles.primary} onClick={() => setReportOpen(true)}>
            Report a post
          </button>
        </div>
        {lastReport && <pre className={styles.output}>{JSON.stringify(lastReport, null, 2)}</pre>}
      </section>

      {reportOpen && (
        <ReportModal
          postId={SAMPLE_POST_ID}
          onSubmit={sampleReport}
          onClose={(result) => {
            setReportOpen(false);
            if (result === "sent") showToast(REPORT_TEXT.sent);
          }}
        />
      )}

      <AppToast toast={toast} bottom={24} />
    </div>
  );
}
