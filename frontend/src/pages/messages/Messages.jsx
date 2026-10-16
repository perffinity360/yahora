// frontend/src/pages/messages/Messages.jsx
import React, {
  memo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./Messages.module.css";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel/InfiniteScrollSentinel";
import { supabase } from "../../config/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  MessageSquare,
  Check,
  CheckCheck,
  Search,
  X,
  Smile,
  Users,
  ChevronsDown,
  AlertCircle,
  Clock,
  RotateCw,
} from "lucide-react";
import { API_BASE_URL } from '../../config/urls';
import { EMOJI_SIZES, jumboEmojiCount, splitEmoji } from "../../utils/emoji";
import { welcomeStickerFor } from "../../utils/stickers";
import {
  formatClockTime,
  formatDayLabel,
  formatInboxTime,
  isGroupedWith,
} from "../../utils/messageFormat";

/**
 * 🔒 Every /api/messages/* route went behind `requireAuth` in Phase 4 Block V-A
 * (docs/CHANGELOG.md, 2026-09-14). Read at call time rather than captured once:
 * the session can be replaced by a re-login while this component is mounted,
 * and a stale token is a 401 that shows up as an empty inbox, not as an error.
 */
const authHeaderToken = () => localStorage.getItem("yahora_session");


/* Which conversation this student had open last. Written on every chat select,
   read back on mount — so stepping out to the Marketplace and coming back
   reopens the same thread instead of the empty "Your Conversations" panel.
   Cleared by AuthContext.clearStoredSession() so it can't leak to the next
   account on a shared device. */
const ACTIVE_CHAT_KEY = "yahora_active_chat";

/* Minimum breathing room left above the unread divider when a thread opens
   on it, used when the thread is too short to give it any more than that. */
const UNREAD_ANCHOR_PADDING = 12;

/* How much of the viewport is kept ABOVE the unread divider on open, as a
   fraction of the container height. The divider landing flush against the top
   of the viewport reads as "the conversation starts here" — there is nothing
   above it to tell you where you left off. Opening with roughly a third of the
   screen showing already-read history puts the line in the middle of the chat,
   which is what makes it legible as a seam between old and new. */
const UNREAD_ANCHOR_LEAD_RATIO = 0.35;

/* How close to the bottom still counts as "reading the live end of the thread".
   Above this, an arriving message must not pull the viewport down. */
const BOTTOM_STICK_THRESHOLD = 80;
/* Scrolled up further than this (px) from the newest message and the
   jump-to-latest button shows — about one message. Same value as mobile's
   JUMP_SHOW_AFTER; the two were tuned together on a phone. */
const JUMP_SHOW_AFTER = 80;

/* 📖 Read on sight (Phase 6A V-E, same values as mobile). Once the thread has
   been still this long — no scroll, no new message — whatever is on screen
   has been seen. */
const READ_DEBOUNCE_MS = 300;
/* How much of a message has to be inside the thread's viewport to count as
   seen. Mobile's `itemVisiblePercentThreshold: 50`. */
const READ_VISIBLE_RATIO = 0.5;

/* ✏️ The composer's limit (spec §2 Composer, "up to 2000 characters"). Same
   value as mobile's MAX_MESSAGE_LENGTH; the server refuses anything longer with
   400 INVALID_FORMAT (Phase 6B V-C). */
const MAX_MESSAGE_LENGTH = 2000;

/* ✉️ Optimistic send (spec §2 "Failed message"; mobile's useSendMessage). A
   message shows the moment you send it, with a clock, and is retried by itself
   (below). If the server refuses it, or every retry fails, the bubble stays,
   dimmed, with "Failed to send" under it. Until the server replies, the
   bubble's id is its `client_tag`. A try that gets no answer within
   SEND_TIMEOUT_MS counts as failed. fetch has no timeout of its own, so without one a send
   on a connection that went quiet would show its clock forever. Same value as
   mobile. */
const SEND_TIMEOUT_MS = 15000;

/* Automatic retry (spec §2): a send that fails for a reason that can pass is
   tried again after 2, 4, 8, 16 and 30 s, keeping its clock. Only then, or at
   once if the server refuses the message itself, does it become "Failed to
   send". Offline, it waits for the `online` event and uses up no tries. Same
   numbers as mobile (useMessages.ts). */
const SEND_MAX_RETRIES = 5;
const sendRetryDelay = (attempt) => Math.min(2000 * 2 ** attempt, 30000);

/* No answer (network, timeout), 401 (the token was being refreshed), 408, 429
   and 5xx can pass. Any other 4xx is the server refusing THIS message, and
   asking again gets the same answer. */
const isRetryableSendError = (error) =>
  !error.status ||
  error.status === 401 ||
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForOnline = () =>
  new Promise((resolve) =>
    window.addEventListener("online", resolve, { once: true }),
  );

const threadKey = (contactId, productId) => `${contactId}|${productId}`;

const newClientTag = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/* Fold a server message into the thread. Mobile's mergeMessage
   (mobile/src/lib/messages.ts); keep the two identical.
   1. Already there by id → refresh it in place.
   2. Else the bubble waiting on this send: by `clientTag` when the caller
      knows it (the send's own response), else a pending bubble from the same
      sender, on the same listing, with the same text (a Realtime INSERT that
      beat the response) → swap the real row in.
   3. Else it's new → append it. */
function mergeServerMessage(list, incoming, clientTag) {
  const byId = list.findIndex((m) => m.id === incoming.id);
  if (byId > -1) {
    const next = [...list];
    next[byId] = incoming;
    return next;
  }
  const waiting = list.findIndex((m) =>
    clientTag
      ? m.client_tag === clientTag
      : m.pending &&
        m.sender_id === incoming.sender_id &&
        m.product_id === incoming.product_id &&
        m.content === incoming.content,
  );
  if (waiting > -1) {
    const next = [...list];
    next[waiting] = incoming;
    return next;
  }
  return [...list, incoming];
}

/* 📄 Block N-C. Where one message is sitting inside the scroll container right
   now, as `{ id, top }` with top measured from the container's own top edge.

   Rects, not offsetTop: offsetTop is relative to whichever ancestor happens to
   be the offsetParent, and the bubbles sit several wrappers deep. Rects are
   relative to the viewport, and subtracting the container's own rect turns two
   viewport-relative numbers into one container-relative one — which is what
   scrollTop is in, so the difference between two of these can be added to it
   directly.

   Returns null when there is no such message on screen; every caller treats
   that as "nothing to anchor to" and leaves the scroll position alone. */
const measureAnchor = (container, id) => {
  if (!container || id === undefined || id === null) return null;
  // The id comes from the database as a uuid; it is only ever a selector here,
  // never markup, and CSS.escape covers the case where that ever stops holding.
  const el = container.querySelector(
    `[data-msg-id="${CSS.escape(String(id))}"]`,
  );
  if (!el) return null;
  return {
    id,
    top: el.getBoundingClientRect().top - container.getBoundingClientRect().top,
  };
};

/* Stands in for a measurement when a page is landing but there is nothing on
   screen to anchor to — an empty thread. It keeps the layout effect on the
   prepend branch, where it stops; without it the effect would fall through and
   read the page as an arriving message, and glide the thread to the bottom. */
const NO_ANCHOR = { id: null, top: 0 };

const readSavedChat = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_CHAT_KEY));
    return saved?.contact_id && saved?.product_id ? saved : null;
  } catch {
    // Hand-edited or half-written value — treat it as "nothing saved".
    return null;
  }
};

/* ── Emoji data ── */
const EMOJI_ROWS = [
  {
    label: "Smileys",
    emojis: [
      "😊",
      "😂",
      "😍",
      "🥺",
      "😭",
      "😎",
      "🤔",
      "🥳",
      "😘",
      "🤗",
      "😅",
      "🤩",
      "😆",
      "🙂",
      "😉",
      "🫡",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍",
      "👏",
      "🙌",
      "🤝",
      "💪",
      "🫶",
      "👌",
      "✌️",
      "🤙",
      "🙏",
      "🫂",
      "❤️",
      "💕",
      "🔥",
      "✨",
      "💯",
    ],
  },
  {
    label: "Campus",
    emojis: [
      "📚",
      "🎒",
      "💻",
      "📱",
      "☕",
      "🍕",
      "🏫",
      "🎓",
      "📝",
      "💡",
      "🎯",
      "⚡",
      "🛍️",
      "📦",
      "💰",
      "🎁",
    ],
  },
];

/* ── Avatar Helper ── */
/* Message body with WhatsApp-style emoji (src/utils/emoji.js): emoji inside
   text at EMOJI_SIZES.inline; a message of only one to three emoji drawn whole
   at the jumbo size. Memoised — the thread re-renders on every keystroke in
   the composer, and splitting text is not free. */
const MessageText = memo(function MessageText({ content }) {
  const jumbo = useMemo(() => jumboEmojiCount(content), [content]);
  const runs = useMemo(() => (jumbo ? null : splitEmoji(content)), [content, jumbo]);

  if (jumbo) {
    const size = EMOJI_SIZES.jumbo[jumbo];
    return (
      <p
        className={styles.messageText}
        style={{ fontSize: size, lineHeight: `${Math.round(size * 1.25)}px` }}
      >
        {content}
      </p>
    );
  }
  return (
    <p className={styles.messageText}>
      {runs.map((run, i) =>
        run.emoji ? (
          <span key={i} className={styles.emojiInline}>
            {run.text}
          </span>
        ) : (
          <React.Fragment key={i}>{run.text}</React.Fragment>
        ),
      )}
    </p>
  );
});

function AvatarImg({ src, name, size = 40, className }) {
  const [err, setErr] = useState(false);
  const displayName = name || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hue =
    displayName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (!src || err) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          background: `linear-gradient(135deg, hsl(${hue},55%,50%), hsl(${hue + 40},55%,40%))`,
          color: "#fff",
          fontWeight: 700,
          fontSize: size * 0.36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
          border: "2px solid rgba(255,255,255,0.12)",
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      onError={() => setErr(true)}
    />
  );
}

export default function Messages() {
  const { sessionReady } = useAuth();
  const currentUserId = localStorage.getItem("yahora_user_id");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isDemoUser = localStorage.getItem("yahora_demo_user") === "true";

  /* ── Existing states ── */
  const [inbox, setInbox] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInboxOnMobile, setShowInboxOnMobile] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  /* ── New UI-only states ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiRow, setActiveEmojiRow] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  /* { id, count } for the first message the contact sent that this student had
     not read at the moment the thread opened — the WhatsApp "unread" line.
     Pinned at open time on purpose: PUT /messages/read and the realtime UPDATE
     handler flip `is_read` on those same rows seconds later, so deriving this
     from `messages` on every render would make the line vanish under the
     reader. */
  const [unreadMarker, setUnreadMarker] = useState(null);

  /* ── 📄 Pagination, Phase 5 Block N-C ──────────────────────────────────────
     The thread pages BACKWARDS: `messages` holds the newest page on open and
     each further page is OLDER and goes on the FRONT of the array. The inbox
     beside it is an ordinary downward list and pages the normal way.

     `hasOlder` / `hasMoreInbox` come from `next_cursor !== null` and from
     nothing else — not from an empty page, not from a short one. */
  const [olderCursor, setOlderCursor] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [inboxCursor, setInboxCursor] = useState(null);
  const [hasMoreInbox, setHasMoreInbox] = useState(false);
  const [loadingMoreInbox, setLoadingMoreInbox] = useState(false);

  /* Both scroll containers, held in state as well as in a ref. The observers
     must be built against the element that actually scrolls — the viewport is
     the wrong box for both of these — and a ref assignment does not re-render,
     so the hook would never see the node arrive. */
  const [messagesEl, setMessagesEl] = useState(null);
  /* Jump to latest (WhatsApp's ⌄ button). `jumpAnchorId` is the newest message
     at the moment the student scrolled away; the badge counts the other
     person's messages after it. Flips only when JUMP_SHOW_AFTER is crossed. */
  const [scrolledUp, setScrolledUp] = useState(false);
  const [jumpAnchorId, setJumpAnchorId] = useState(null);
  const scrolledUpRef = useRef(false);
  const [inboxListEl, setInboxListEl] = useState(null);

  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);

  /* The composer grows with its text up to 5 lines (spec §2), then scrolls.
     Measured after every change, including the reset to "" on send. */
  useLayoutEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight excludes the border; add it back (border-box sizing).
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [newMessage]);
  const emojiPickerRef = useRef(null);
  const activeChatRef = useRef(activeChat);
  const currentUserIdRef = useRef(currentUserId);
  /* Messages not yet confirmed (pending or failed), per thread, kept OUTSIDE
     `messages`: opening another chat replaces `messages` with that chat's
     history, and a failed bubble must still be there, with its pill, when you
     come back. fetchHistory adds them back; see `deliver`. Mobile keeps them in
     its query cache instead. */
  const unsentRef = useRef(new Map());
  /* threadKey → the promise of that conversation's last queued send. */
  const sendQueueRef = useRef(new Map());
  const unreadDividerRef = useRef(null);

  /* True between "a thread was picked" and "that thread's messages painted".
     Tells the scroll effect to place the viewport once, instead of gliding to
     the bottom the way it does for a message that just arrived. */
  const pendingInitialScrollRef = useRef(false);

  /* How many messages the scroll effect last acted on. Only a GROWING list is a
     new message; a receipt rewrites the same rows in place. */
  const previousCountRef = useRef(0);

  /* Ids the thread already had when it opened. Everything in here is history
     and must render settled; only messages that arrive AFTER open animate in.
     Without this, opening a thread flew every message in at once — which is
     both noisy and self-defeating, since the point of anchoring on the unread
     line is to look like you walked back into a conversation already there. */
  const openingIdsRef = useRef(new Set());

  /* Whether the reader is parked at the live end of the thread. Sampled on
     scroll — i.e. before new content lands — so an arriving message can tell
     "follow the conversation" apart from "yank someone out of the backlog they
     are still reading". */
  const isAtBottomRef = useRef(true);

  /* Which account the inbox effect below has already run for — see the note
     inside it. */
  const didInitForUserRef = useRef(null);

  /* ── 📄 Block N-C bookkeeping ─────────────────────────────────────────────
     `historyRunRef` is bumped on every thread open, so a page still in the air
     for the PREVIOUS conversation can be recognised and dropped instead of
     prepending one student's history above another's. `historyAbortRef`
     cancels it outright where it can. */
  const historyInFlightRef = useRef(false);
  const historyRunRef = useRef(0);
  const historyAbortRef = useRef(null);
  const inboxInFlightRef = useRef(false);

  /* Where the oldest message on screen was sitting in the instant BEFORE an
     older page was handed to React — `{ id, top }`, top measured from the top
     edge of the scroll container. The layout effect finds that same message
     once the page is laid out and pushes scrollTop by however far it moved.
     null means "no page is landing", which is what keeps the compensation from
     firing on an ordinary new message.

     It is deliberately an ELEMENT's position and not the container's
     scrollHeight. A height delta is only the right correction if scrollTop is
     untouched between the two measurements, and in this thread it is not:
     Chrome's scroll anchoring moves it (see `overflow-anchor: none` in the
     CSS), and a realtime message can be appended to the BOTTOM in the same
     commit, which grows scrollHeight without moving anything the reader is
     looking at. Re-measuring the anchor after the fact is immune to both — it
     asks the only question that matters, "how far did the message under their
     eyes move", and the answer already accounts for whatever else happened. */
  const prependAnchorRef = useRef(null);

  /* `messages` as of this render, so the prepend can be de-duplicated against
     the list without putting `messages` in loadOlderMessages' dependencies —
     which would rebuild the callback, and with it the observer, on every
     single message that arrives. */
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  /* Whether this student is actually LOOKING at the page: the tab is visible
     and the window has focus. A message that lands while this is false has not
     been seen by anyone, so it must not be marked read — see the note on the
     watcher effect. Starts optimistic; the effect corrects it on mount. */
  const isWatchingRef = useRef(true);

  /* { id, count } for the run of messages that arrived in the OPEN thread while
     this student was away. Held here rather than in state because it is written
     from the realtime handler, which reads refs only; it is promoted into
     `unreadMarker` the moment they come back. */
  const awayUnreadRef = useRef(null);

  /* Set when `unreadMarker` was just filled in by a return from away, to tell
     the anchoring effect to place the viewport on the new divider. Opens use
     `pendingInitialScrollRef` instead — same placement, different trigger. */
  const pendingReturnAnchorRef = useRef(false);

  /* 📖 Read on sight — see flushVisibleRead(). The pending debounce, and the
     newest message this thread has already been marked read up to, so the
     same position is not sent twice while its receipts are still arriving. */
  const readTimerRef = useRef(null);
  const lastReadIdRef = useRef(null);

  /* ?user=&product= as they were on the FIRST render. Captured in a ref so the
     inbox effect below can stay out of `searchParams` — see the note there. */
  const deepLinkRef = useRef({
    user: searchParams.get("user"),
    product: searchParams.get("product"),
  });

  /* Callback refs that keep the existing ref AND the state copy in step. The
     ref is what the scroll code reads synchronously; the state is what the
     observers are built against. */
  const attachMessagesContainer = useCallback((node) => {
    messagesContainerRef.current = node;
    setMessagesEl(node);
  }, []);

  const scrollToBottom = (behavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const fromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = fromBottom < BOTTOM_STICK_THRESHOLD;

    // Jump-to-latest: React state only when the threshold is crossed.
    const up = fromBottom > JUMP_SHOW_AFTER;
    if (up !== scrolledUpRef.current) {
      scrolledUpRef.current = up;
      setScrolledUp(up);
      const list = messagesRef.current;
      setJumpAnchorId(up && list.length ? list[list.length - 1].id : null);
    }

    scheduleRead();
  };

  /* ── 📖 READ ON SIGHT (Phase 6A V-E — the same rule as mobile) ──────────
     A message is read once at least half of it has been inside the thread's
     viewport — not when the thread opens, and not when it arrives. Rahul opens
     eight messages from Priya, reads the first three under the line and is
     called away: Priya sees three read, not eight, and Rahul comes back to a
     "5 unread messages" line.

     Every scroll, new message, receipt and return to the tab restarts one
     READ_DEBOUNCE_MS timer. When the thread has been still that long, the
     newest unread message from the contact that is on screen is sent as a
     read POSITION — PUT /messages/read with `upToId` — and everything at or
     before it turns read. Measured at that moment, not tracked as it scrolls
     past, so it always describes the viewport the reader stopped on: after an
     open or a return lands on the unread line, never the instant before.

     Reads refs only, so the long-lived realtime and watcher callbacks that
     reach it through their first-render closures are never stale. */
  const scheduleRead = () => {
    clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(() => {
      readTimerRef.current = null;
      flushVisibleRead();
    }, READ_DEBOUNCE_MS);
  };

  const flushVisibleRead = () => {
    const container = messagesContainerRef.current;
    const chat = activeChatRef.current;
    const myId = currentUserIdRef.current;
    // Nobody looking (backgrounded tab — see the watcher), or the pane has no
    // layout (phone, inbox list up): nothing on it has been seen.
    if (!container || !container.clientHeight || !chat || !myId) return;
    if (!isWatchingRef.current) return;

    const list = messagesRef.current;
    // Self-chat messages were never "unread" — same filter as the line.
    const isUnreadFromContact = (m) =>
      m.receiver_id === myId && m.sender_id !== myId && !m.is_read;

    // Already sent up to here; only something newer can move the position.
    const sentAt = lastReadIdRef.current
      ? list.findIndex((m) => m.id === lastReadIdRef.current)
      : -1;

    const box = container.getBoundingClientRect();
    let bound = -1;
    for (let i = list.length - 1; i > sentAt; i--) {
      if (!isUnreadFromContact(list[i])) continue;
      const el = container.querySelector(
        `[data-msg-id="${CSS.escape(String(list[i].id))}"]`,
      );
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const shown = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
      if (r.height > 0 && shown / r.height >= READ_VISIBLE_RATIO) {
        bound = i;
        break;
      }
    }
    if (bound === -1) return;

    // The contact's unread messages after the position stay unread, and that is
    // what the badge should say.
    let remaining = 0;
    for (let i = bound + 1; i < list.length; i++) {
      if (isUnreadFromContact(list[i])) remaining++;
    }

    const upToId = list[bound].id;
    lastReadIdRef.current = upToId;

    fetch(`${API_BASE_URL}/messages/read`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(authHeaderToken() ? { Authorization: `Bearer ${authHeaderToken()}` } : {}),
      },
      body: JSON.stringify({
        userId: myId,
        contactId: chat.contact_id,
        productId: chat.product_id,
        upToId,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`read ${res.status}`);
      })
      .catch((error) => {
        // Not recorded: let the next still moment send it again.
        if (lastReadIdRef.current === upToId) lastReadIdRef.current = null;
        console.error("Failed to mark messages read:", error);
      });

    setInbox((prev) =>
      prev.map((c) =>
        c.contact_id === chat.contact_id && c.product_id === chat.product_id
          ? { ...c, unread_count: remaining }
          : c,
      ),
    );
  };

  // A new message, a receipt, a page, or the pane coming into view on a phone
  // can change what is unread on screen without anyone scrolling.
  useEffect(() => {
    scheduleRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, showInboxOnMobile]);

  useEffect(() => () => clearTimeout(readTimerRef.current), []);

  /* Park the viewport a lead-in short of the unread divider, so the tail of the
     already-read history sits above the line and the line reads as a seam in
     the middle of the chat rather than as the top of the thread.

     Returns false when there is no divider to anchor on, which is the caller's
     cue to fall back to the bottom of the thread. */
  const anchorToUnreadDivider = () => {
    const container = messagesContainerRef.current;
    const divider = unreadDividerRef.current;
    if (!container || !divider) return false;

    // On a phone the chat pane is `display: none` while the inbox list is up
    // (`.hideOnMobile`), so it is still mounted but has no layout — every rect
    // reads zero and the "anchor" would just scroll a pane nobody can see.
    if (!container.clientHeight) return false;

    // Distance from the top of the viewport to the divider, measured off the
    // rects rather than offsetTop so it doesn't depend on which ancestor
    // happens to be the offsetParent. Adding it to the current scrollTop works
    // from wherever the browser left the container.
    const offset =
      divider.getBoundingClientRect().top -
      container.getBoundingClientRect().top;

    // Proportional, not a fixed pixel count: the chat pane is roughly half as
    // tall on a phone as on a desktop, and a lead-in sized for one leaves the
    // divider either glued to the top edge or pushed off the bottom on the
    // other. A third of whatever the pane actually is holds on both.
    const lead = Math.max(
      UNREAD_ANCHOR_PADDING,
      Math.round(container.clientHeight * UNREAD_ANCHOR_LEAD_RATIO),
    );
    container.scrollTop += offset - lead;

    // The browser clamps scrollTop to the scrollable range, so a thread with
    // only a message or two under the divider can end up parked at the live end
    // after all. Sample the result instead of assuming it.
    handleMessagesScroll();
    return true;
  };

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // A different conversation opens at the bottom, with no jump button.
  useEffect(() => {
    scrolledUpRef.current = false;
    setScrolledUp(false);
    setJumpAnchorId(null);
  }, [activeChat?.contact_id, activeChat?.product_id]);

  /* This conversation's welcome sticker — fixed per chat, and the same one the
     phone shows (src/utils/stickers.js). */
  const welcomeSticker = useMemo(
    () => welcomeStickerFor(currentUserId, activeChat?.contact_id, activeChat?.product_id),
    [currentUserId, activeChat?.contact_id, activeChat?.product_id],
  );

  const newBelow = useMemo(() => {
    if (!scrolledUp || !jumpAnchorId) return 0;
    const at = messages.findIndex((m) => m.id === jumpAnchorId);
    if (at === -1) return 0;
    let count = 0;
    for (let i = at + 1; i < messages.length; i++) {
      if (messages[i].sender_id !== currentUserId) count++;
    }
    return count;
  }, [scrolledUp, jumpAnchorId, messages, currentUserId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  /* ── Scroll positioning ──
     Two behaviours share one effect:
       • a thread just opened  → land instantly on the first unread message
         (or the bottom, when everything is already read).
       • a message arrived     → glide to the bottom.

     The instant landing is why `scroll-behavior: smooth` was removed from
     .messagesContainer: with it, opening an old chat animated the entire
     backlog past the reader for about a second before settling.

     useLayoutEffect, not useEffect: this measures the divider and moves the
     viewport, and it has to happen before the browser paints. A passive effect
     runs after, so the reader would catch one frame at the top of the thread
     before it snapped down to the divider. */
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const count = messages.length;
    const previousCount = previousCountRef.current;
    previousCountRef.current = count;

    if (pendingInitialScrollRef.current) {
      pendingInitialScrollRef.current = false;
      // An open places the viewport outright, so any measurement left over
      // from a page that was in the air belongs to the thread being left.
      prependAnchorRef.current = null;
      // The divider is the whole point of the anchored open; without one there
      // is nothing unread, so the live end of the thread is where to land.
      if (!anchorToUnreadDivider()) {
        scrollToBottom("auto");
        isAtBottomRef.current = true;
      }
      return;
    }

    /* ── 📄 SCROLL COMPENSATION — Phase 5 Block N-C ────────────────────────
       This is the whole block, and it is why this effect is useLayoutEffect
       and not useEffect.

       A page of older messages went on the FRONT of the list, so every
       message already on screen has just been pushed DOWN by the height of
       what was inserted above it. `scrollTop` is measured from the top of the
       content, so a value that pointed at the message under the reader's eyes
       now points a whole page further back in the conversation. Nobody can be
       relied on to fix that: the browser fixes it sometimes (see the CSS note
       on `overflow-anchor`) and Safari never does.

       So: find the message that was at the top of the list before the page
       arrived, see how far down the insertion pushed it, and push `scrollTop`
       by the same amount. It ends up back under their eyes.

       This is a RE-MEASUREMENT, not a height delta, and that is the whole
       point — by the time this runs, scrollTop may already have been moved by
       someone else (Chrome's scroll anchoring did exactly that, which is the
       bug this shape fixes; see the CSS note). Asking the DOM where the anchor
       actually is now folds in anything that happened in between, so the
       correction is right whatever else touched the container.

       React runs a layout effect after the DOM is updated but BEFORE the
       browser paints, so this correction is inside the same frame as the
       insertion and there is nothing to see. In a passive useEffect the
       browser would paint the jumped position first and the correction would
       land a frame later, as a visible flick. */
    if (prependAnchorRef.current !== null) {
      const before = prependAnchorRef.current;
      prependAnchorRef.current = null;

      // Only when the list actually grew. A page that turned out to be
      // entirely duplicates commits nothing, and compensating for a layout
      // that never changed would scroll the thread for no reason.
      if (count > previousCount) {
        const after = measureAnchor(container, before.id);
        // The anchor is gone only if the thread was swapped out from under
        // this commit, in which case whoever swapped it has placed the
        // viewport already and there is nothing here to correct.
        if (after !== null) {
          container.scrollTop += after.top - before.top;
          // The prepend changed how far the reader is from the live end;
          // sample it rather than leaving a stale answer for the next arrival.
          handleMessagesScroll();
        }
      }
      return;
    }

    // The list didn't grow, so `messages` was rewritten in place — which is
    // exactly what a receipt does. PUT /messages/read flips `is_read` on every
    // unread row in one statement (and the navbar's PUT /messages/deliver does
    // the same for `is_delivered`), and each row comes back as its own realtime
    // UPDATE. Scrolling on those is what dragged the reader off the unread
    // divider and down to the newest message a moment after the thread opened —
    // the anchoring was working, the receipts were undoing it.
    if (count <= previousCount) return;

    // A message was appended. Follow it only when the reader is already at the
    // live end, or sent it themselves. Otherwise someone still working through
    // the backlog gets yanked to the bottom every time the other side types.
    //
    // `isWatchingRef` is the third condition: nobody is reading a backgrounded
    // tab, so scrolling it to the bottom only destroys the position the unread
    // divider needs when they come back. Their own message can't arrive while
    // they are away, so `isMine` needs no such guard.
    const isMine = messages[count - 1]?.sender_id === currentUserId;
    if (isMine) {
      // Your own message: land on it instantly, as WhatsApp does. A smooth
      // scroll here made the whole thread visibly slide down on every send.
      scrollToBottom("auto");
    } else if (isWatchingRef.current && isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, currentUserId]);

  /* Placing the viewport for the OTHER way a divider appears: it was drawn on
     the messages that landed while this student was away, and `messages` did
     not change in that commit, so the effect above never runs. Separate effect,
     same placement — and useLayoutEffect for the same reason. */
  useLayoutEffect(() => {
    if (!pendingReturnAnchorRef.current) return;
    pendingReturnAnchorRef.current = false;
    anchorToUnreadDivider();
  }, [unreadMarker]);

  /* Promote the run of messages that landed while this student was away into
     the visible unread line. Reading them is READ ON SIGHT's job: the watcher
     schedules it right after this, and by the time it runs the viewport has
     been anchored on the line. */
  const flushAwayUnread = () => {
    const pending = awayUnreadRef.current;
    if (!pending) return;

    // On a phone the open thread can be sitting behind the inbox list, so
    // coming back to the TAB is not the same as coming back to the
    // CONVERSATION. Leave the run pending in that case: the sidebar badge goes
    // on counting it and opening the thread draws the line the ordinary way.
    const container = messagesContainerRef.current;
    if (!container || !container.clientHeight) return;

    awayUnreadRef.current = null;

    // Replaces any earlier divider on purpose: that one marked messages this
    // student has since read, and two lines in one thread would be a puzzle.
    // The receipts READ ON SIGHT sends do not erase the line: `unreadMarker` is
    // pinned state, not something derived from `is_read` — see that state.
    setUnreadMarker(pending);
    pendingReturnAnchorRef.current = true;
  };

  /* ── Are they actually looking at this? ──
     A message that arrives while the tab is hidden or the window is behind
     something else has not been seen, so marking it read the moment it lands —
     which the realtime handler used to do — is a lie, and it costs this
     student the "N unread messages" line on the one visit that needed it: they
     step away mid-thread, twenty messages pile up, and they come back to a
     wall of chat with no idea where they stopped.

     Both signals are needed. Switching apps or tabs on a phone fires
     visibilitychange; alt-tabbing to another window on a desktop leaves the tab
     "visible" and only blurs it. Pointer and key events force the flag back on
     regardless: they cannot happen unless someone is there, which keeps a
     browser that reports focus oddly from stranding the thread in "away". */
  useEffect(() => {
    const setWatching = (watching) => {
      if (watching === isWatchingRef.current) return;
      isWatchingRef.current = watching;
      if (!watching) return;
      flushAwayUnread();
      // Whatever is on screen now is being looked at again.
      scheduleRead();
    };

    const evaluate = () =>
      setWatching(document.visibilityState === "visible" && document.hasFocus());
    const markPresent = () => setWatching(true);

    evaluate();

    document.addEventListener("visibilitychange", evaluate);
    window.addEventListener("focus", evaluate);
    window.addEventListener("blur", evaluate);
    document.addEventListener("pointerdown", markPresent, { passive: true });
    document.addEventListener("keydown", markPresent, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", evaluate);
      window.removeEventListener("focus", evaluate);
      window.removeEventListener("blur", evaluate);
      document.removeEventListener("pointerdown", markPresent);
      document.removeEventListener("keydown", markPresent);
    };
    // Reads the open thread and the account through refs, so it subscribes once
    // for the life of the page instead of re-binding on every chat switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Close emoji picker on outside click ── */
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handler = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  /* ── 1. Fetch inbox, then reopen whichever chat should be open ──
     Precedence: the ?user=&product= deep link (e.g. "Message Seller" on a
     product page) first, then the thread this student last had open.

     Deliberately NOT keyed on `searchParams`. handleSelectChat() calls
     navigate() to keep the URL in sync, and that hands back a fresh
     searchParams object; with it in the dep array, every chat click re-ran
     this whole effect — refetching the inbox AND the history of the chat that
     was just clicked. The first-render params are read from a ref instead. */
  useEffect(() => {
    if (!currentUserId) return navigate("/auth");

    // StrictMode runs this twice on mount in dev, which opened the restored
    // thread twice: two GET /messages/history in flight, and the second one
    // landing after the first one's PUT /messages/read had already marked the
    // rows read. Refs survive StrictMode's remount, so keying the guard on the
    // account this ran for makes it a dedupe rather than a one-shot latch.
    if (didInitForUserRef.current === currentUserId) return;
    didInitForUserRef.current = currentUserId;

    const loadInboxAndCheckParams = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/messages/inbox/${currentUserId}`,
          {
            headers: authHeaderToken()
              ? { Authorization: `Bearer ${authHeaderToken()}` }
              : {},
          },
        );
        const data = await res.json();
        let fetchedInbox = data.items || [];

        // 📄 Page one of the inbox. Everything past the first 20 conversations
        // used to be simply unreachable — the response has carried a
        // `next_cursor` since Block N-C and nothing read it.
        const firstInboxCursor = data.next_cursor ?? null;
        setInboxCursor(firstInboxCursor);
        setHasMoreInbox(firstInboxCursor !== null);

        let paramUserId = deepLinkRef.current.user;
        let paramProductId = deepLinkRef.current.product;
        const isDeepLink = Boolean(paramUserId && paramProductId);

        if (!isDeepLink) {
          const saved = readSavedChat();
          if (saved) {
            paramUserId = saved.contact_id;
            paramProductId = saved.product_id;
          }
        }

        if (paramUserId && paramProductId) {
          const existingChat = fetchedInbox.find(
            (chat) =>
              chat.contact_id === paramUserId &&
              chat.product_id === paramProductId,
          );

          if (existingChat) {
            // A deep link already carries the pair in the URL; a restore does
            // not, so let handleSelectChat put it back there.
            handleSelectChat(existingChat, isDeepLink);
          } else if (isDeepLink) {
            const prodRes = await fetch(
              `${API_BASE_URL}/products/${paramProductId}`,
            );
            const prodData = await prodRes.json();

            if (prodData.product) {
              const newChatData = {
                contact_id: paramUserId,
                product_id: paramProductId,
                contact_name: prodData.product.seller?.full_name || "User",
                contact_avatar: prodData.product.seller?.avatar_url,
                product_title: prodData.product.title,
                product_image:
                  prodData.product.image_urls?.[0] ||
                  "https://via.placeholder.com/20",
                unread_count: 0,
              };

              fetchedInbox = [newChatData, ...fetchedInbox];
              handleSelectChat(newChatData, true);
            }
          } else {
            // The remembered thread is gone from the inbox (listing deleted,
            // different account). Drop the pointer rather than fabricating a
            // chat out of it the way the deep-link branch above does.
            localStorage.removeItem(ACTIVE_CHAT_KEY);
          }
        }

        setInbox(fetchedInbox);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadInboxAndCheckParams();
  }, [currentUserId, navigate]);

  /* ── 📄 Older messages — Phase 5 Block N-C ────────────────────────────────
     Scrolling UP loads the page BEFORE the oldest one on screen.

     The backend hands each page back oldest-first already (Phase 4 Block N-C
     queries descending and reverses before sending), so the page is prepended
     AS A BLOCK, exactly as received. Nothing here sorts, and nothing here
     reorders. If the order ever looks wrong on screen, the page arrived wrong
     and that is a backend bug to report, not something to paper over here. */
  const loadOlderMessages = useCallback(async () => {
    const chat = activeChatRef.current;
    const container = messagesContainerRef.current;
    if (!chat || !container) return;
    if (!hasOlder || olderCursor === null) return;

    // 🚦 DOUBLE-FETCH GUARD. The hook also tears the observer down for the
    // duration of a request, but the observer is not the only caller, and
    // IntersectionObserver fires repeatedly while the sentinel is on screen.
    if (historyInFlightRef.current) return;
    historyInFlightRef.current = true;

    const run = historyRunRef.current;
    const controller = new AbortController();
    historyAbortRef.current = controller;
    setLoadingOlder(true);

    try {
      const params = new URLSearchParams({
        userId: currentUserId,
        contactId: chat.contact_id,
        productId: chat.product_id,
        // Verbatim, never rebuilt: the cursor is an opaque base64url
        // `created_at|id` pair and its encoding is explicitly not a contract.
        cursor: olderCursor,
      });

      const token = authHeaderToken();
      const res = await fetch(
        `${API_BASE_URL}/messages/history?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        },
      );

      // Same reasoning as the first page: a 401 has a perfectly good JSON body,
      // so the status has to be checked or the failure is silent.
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          `history ${res.status} ${body?.error || ""}`.trim(),
        );
      }

      const data = await res.json();

      // A different conversation was opened while this was in the air. Its
      // messages must not be prepended above someone else's thread.
      if (run !== historyRunRef.current) return;

      const page = data.items || [];
      const known = new Set(messagesRef.current.map((m) => m.id));
      const older = page.filter((m) => !known.has(m.id));

      if (older.length) {
        // History renders SETTLED. `openingIdsRef` is what suppresses the
        // fly-in animation, and without this every message of a page that is
        // being scrolled back into would animate in as if it were new.
        older.forEach((m) => openingIdsRef.current.add(m.id));

        // ⬇️ THE MEASUREMENT the layout effect compensates against. Taken
        // here, immediately before React is handed the new list, so it is the
        // thread exactly as the reader is currently looking at it. The anchor
        // is the oldest message on screen: it is the row the incoming page
        // lands directly above, and with the sentinel 300px from the top when
        // the fetch fires it is always near the viewport, so its position is a
        // meaningful thing to hold still.
        prependAnchorRef.current =
          measureAnchor(container, messagesRef.current[0]?.id) ?? NO_ANCHOR;

        // Functional update, and the page goes on the FRONT as one block: a
        // realtime message may have been appended to the end since this
        // request went out, and it must stay at the end.
        setMessages((prev) => [...older, ...prev]);
      }

      const nextCursor = data.next_cursor ?? null;
      setOlderCursor(nextCursor);
      setHasOlder(nextCursor !== null);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Failed to load older messages:", error);
    } finally {
      // Not when the thread has moved on: handleSelectChat has already reset
      // these for the new conversation and this is the old one finishing.
      if (run === historyRunRef.current) {
        historyInFlightRef.current = false;
        setLoadingOlder(false);
      }
    }
  }, [currentUserId, hasOlder, olderCursor]);

  /* The trigger sits at the TOP of the thread — see the sentinel in the render
     below. `messagesEl` is the root because the thread scrolls inside its own
     element; until that element exists there is nothing to measure against, so
     `hasMore` stays false and no observer is built. */
  const olderMessagesSentinelRef = useInfiniteScroll({
    hasMore: hasOlder && messagesEl !== null,
    isLoading: loadingOlder,
    onLoadMore: loadOlderMessages,
    root: messagesEl,
    rootMargin: "300px",
  });

  /* ── 📄 More conversations — the ordinary downward list ────────────────────
     The inbox sidebar is a plain newest-first list that grows at the BOTTOM,
     so it takes the standard bottom-sentinel pattern, the same one the
     marketplace grid uses. Nothing is reversed and nothing is compensated. */
  const loadMoreInbox = useCallback(async () => {
    if (!currentUserId) return;
    if (!hasMoreInbox || inboxCursor === null) return;
    if (inboxInFlightRef.current) return;
    inboxInFlightRef.current = true;
    setLoadingMoreInbox(true);

    try {
      const params = new URLSearchParams({ cursor: inboxCursor });
      const token = authHeaderToken();
      const res = await fetch(
        `${API_BASE_URL}/messages/inbox/${currentUserId}?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(`inbox ${res.status} ${body?.error || ""}`.trim());
      }

      const data = await res.json();
      const page = data.items || [];

      setInbox((prev) => {
        // A conversation already on screen can appear on a later page too: the
        // realtime handler moves a thread to the top of the list the moment a
        // message lands in it, which shifts everything below it by one.
        const seen = new Set(
          prev.map((c) => `${c.contact_id}-${c.product_id}`),
        );
        const next = page.filter(
          (c) => !seen.has(`${c.contact_id}-${c.product_id}`),
        );
        return next.length ? [...prev, ...next] : prev;
      });

      const nextCursor = data.next_cursor ?? null;
      setInboxCursor(nextCursor);
      setHasMoreInbox(nextCursor !== null);
    } catch (error) {
      console.error("Failed to load more conversations:", error);
    } finally {
      inboxInFlightRef.current = false;
      setLoadingMoreInbox(false);
    }
  }, [currentUserId, hasMoreInbox, inboxCursor]);

  const inboxSentinelRef = useInfiniteScroll({
    hasMore: hasMoreInbox && inboxListEl !== null,
    isLoading: loadingMoreInbox,
    onLoadMore: loadMoreInbox,
    root: inboxListEl,
  });

  /* ── 2. Select Chat ── */
  const handleSelectChat = async (chat, isInitialLoad = false) => {
    setActiveChat(chat);
    setShowInboxOnMobile(false);
    setShowEmojiPicker(false);

    // The next paint of `messages` belongs to a freshly opened thread, so the
    // scroll effect should place the viewport rather than glide to the bottom.
    pendingInitialScrollRef.current = true;
    pendingReturnAnchorRef.current = false;
    setUnreadMarker(null);
    // Belongs to the thread being left, not to this one.
    awayUnreadRef.current = null;
    // So does a pending read, and the position already sent.
    clearTimeout(readTimerRef.current);
    readTimerRef.current = null;
    lastReadIdRef.current = null;

    /* 📄 RESET THE PAGER. A new thread is a different history: the cursor, the
       end-of-list flag and any page still in the air all belong to the
       conversation being left. Bumping the run id is what makes a late
       response identifiable as stale — the abort handles the common case, but
       a request whose response is already on the wire cannot be called back. */
    historyRunRef.current += 1;
    historyAbortRef.current?.abort();
    historyInFlightRef.current = false;
    prependAnchorRef.current = null;
    setOlderCursor(null);
    setHasOlder(false);
    setLoadingOlder(false);

    // Remember it for the next mount — see ACTIVE_CHAT_KEY.
    localStorage.setItem(
      ACTIVE_CHAT_KEY,
      JSON.stringify({
        contact_id: chat.contact_id,
        product_id: chat.product_id,
      }),
    );

    if (!isInitialLoad) {
      navigate(`/messages?user=${chat.contact_id}&product=${chat.product_id}`, {
        replace: true,
      });
    }

    try {
      // 🔒 GET /messages/history is behind requireAuth (backend §1.6 security
      // fix — see docs/CHANGELOG.md 2026-08-23). Without this header the call
      // returns 401, `data.messages` is undefined, and the line below used to
      // blank the thread — which looked exactly like "the old messages were
      // deleted". Realtime kept working throughout because it goes straight to
      // Supabase and never touches this endpoint, which is why only the
      // reopened chat appeared empty.
      //
      // Read at call time, not once at mount: supabase-js auto-refreshes the
      // access token in the background and AuthContext writes the new one back
      // to this key, so a cached copy goes stale on a long-lived page.
      const token = localStorage.getItem("yahora_session");

      const res = await fetch(
        `${API_BASE_URL}/messages/history?userId=${currentUserId}&contactId=${chat.contact_id}&productId=${chat.product_id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );

      // Check the status before trusting the body. `res.json()` succeeds on a
      // 401 too — its body is just `{"error":"UNAUTHORIZED"}` — so without this
      // the failure is completely silent and shows up as an empty conversation
      // rather than as an error.
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          `history ${res.status} ${body?.error || ""} ${body?.message || ""}`.trim(),
        );
      }

      const data = await res.json();
      const history = data.items || [];
      // Bring back this thread's unsent messages (pending or failed), at the
      // bottom where they were typed, unless the server already has one. Same
      // rule as mobile's useChatHistory.
      const unsent = [
        ...(unsentRef.current
          .get(threadKey(chat.contact_id, chat.product_id))
          ?.values() ?? []),
      ].filter(
        (u) =>
          !history.some(
            (s) => s.sender_id === u.sender_id && s.content === u.content,
          ),
      );
      const thread = unsent.length ? [...history, ...unsent] : history;
      openingIdsRef.current = new Set(thread.map((m) => m.id));
      setMessages(thread);

      // 📄 Page one of the history. `next_cursor` points at the messages
      // BEFORE this page — scrolling up is what asks for them — and a null
      // here is the only thing that means "this is the whole conversation".
      const firstCursor = data.next_cursor ?? null;
      setOlderCursor(firstCursor);
      setHasOlder(firstCursor !== null);

      // Work this out BEFORE the read-receipt PUT below clears `is_read` on the
      // server and the realtime UPDATE handler mirrors that into state.
      // Messages this student sent to themselves are excluded: in a self-chat
      // both ids are the same person, and nothing there was ever "unread".
      const fromContact = history.filter(
        (m) =>
          m.receiver_id === currentUserId && m.sender_id !== currentUserId,
      );
      let unread = fromContact.filter((m) => !m.is_read);

      // The inbox count is the server's answer for this thread as of this page
      // load, and it is the more reliable of the two: `is_read` on these rows
      // can already have been flipped by a read receipt in flight — StrictMode
      // opens the thread twice in dev, and leaving the page and coming back
      // fires PUT /messages/read again — in which case the filter above finds
      // nothing and the line silently disappears on exactly the visit that
      // needed it. When the count says there are more, trust it and take that
      // many from the end of the contact's messages.
      const reportedUnread = Number(chat.unread_count || 0);
      if (reportedUnread > unread.length) {
        unread = fromContact.slice(-reportedUnread);
      }

      setUnreadMarker(
        unread.length ? { id: unread[0].id, count: unread.length } : null,
      );

      // Opening is no longer reading (Phase 6A V-E). The layout effect anchors
      // the viewport on the line, and READ ON SIGHT marks read only what that
      // leaves on screen, once it has been there READ_DEBOUNCE_MS. The badge
      // keeps counting the rest.
    } catch (error) {
      // Clear on failure. Leaving the previous chat's messages on screen under
      // the newly selected contact's header would render one student's
      // conversation as if it belonged to another — worse than showing nothing.
      setMessages([]);
      setUnreadMarker(null);
      awayUnreadRef.current = null;
      openingIdsRef.current = new Set();
      // No first page means no cursor to continue from; leaving `hasOlder` set
      // would point the observer at a thread that was never loaded.
      setOlderCursor(null);
      setHasOlder(false);
      console.error("Failed to load chat history:", error);
    }
  };

  /* ── 3. Presence ── */
  useEffect(() => {
    if (window.yahoraOnlineUsers) {
      setOnlineUsers(new Set(window.yahoraOnlineUsers));
    }

    const handlePresenceSync = (e) => setOnlineUsers(new Set(e.detail));
    window.addEventListener("yahora-presence", handlePresenceSync);

    return () =>
      window.removeEventListener("yahora-presence", handlePresenceSync);
  }, []);

  /* ── 4. Realtime (Socket Never Closes) ── */
  useEffect(() => {
    // Realtime re-checks the SELECT policy for the subscribed role against every
    // changed row. A channel opened before the client is authenticated is stuck
    // on `anon` and, once migration 004 lands, goes permanently silent — no
    // error, no callback, just a chat that never updates. So wait for the session.
    if (!sessionReady) return;

    // We don't check currentUserId here directly so the hook doesn't re-run.
    const msgChannel = supabase
      .channel("realtime:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new;
          
          // Read the absolute latest state from the refs!
          const chat = activeChatRef.current;
          const myId = currentUserIdRef.current;

          if (!myId) return;

          // Stop typing indicator if the contact replied
          if (chat && newMsg.sender_id === chat.contact_id) {
            setIsTyping(false);
          }

          if (newMsg.sender_id === myId || newMsg.receiver_id === myId) {
            if (
              chat &&
              newMsg.product_id === chat.product_id &&
              (newMsg.sender_id === chat.contact_id || newMsg.receiver_id === chat.contact_id)
            ) {
              // Never twice: refreshes a row already there, or replaces the
              // pending bubble of my own send when this beats its response.
              // That bubble has already slid in, so the swap doesn't animate.
              // Also take it out of the unsent store, which tells a retry loop
              // waiting on it that the message got through.
              const claimed = messagesRef.current.find(
                (m) =>
                  m.pending &&
                  m.sender_id === newMsg.sender_id &&
                  m.product_id === newMsg.product_id &&
                  m.content === newMsg.content,
              );
              if (claimed) {
                openingIdsRef.current.add(newMsg.id);
                dropUnsent(claimed);
              }
              setMessages((prev) => mergeServerMessage(prev, newMsg));
              
              if (newMsg.receiver_id === myId) {
                // They are on the thread with their eyes on it: no divider, and
                // READ ON SIGHT marks it read once it is on screen — at once
                // at the live end, only when they get there if scrolled up.
                // (The `messages` change above schedules that check.)
                if (!isWatchingRef.current) {
                  // The page is open but nobody is at it. Hold the run: the
                  // first of these is where the line goes when they return.
                  awayUnreadRef.current = awayUnreadRef.current
                    ? {
                        ...awayUnreadRef.current,
                        count: awayUnreadRef.current.count + 1,
                      }
                    : { id: newMsg.id, count: 1 };
                }
              }
            }

            // Update Inbox
            setInbox((prev) => {
              const chatIndex = prev.findIndex(
                (c) =>
                  c.product_id === newMsg.product_id &&
                  (c.contact_id === newMsg.sender_id || c.contact_id === newMsg.receiver_id)
              );
              let updatedInbox = [...prev];
              let updatedChat = null;

              if (chatIndex > -1) {
                // A copy, never the row in `prev`. This updater must be pure:
                // React runs it twice in StrictMode, and editing the shared
                // row in place added the unread +1 twice — the sidebar badge
                // counted every incoming message double.
                updatedChat = { ...updatedInbox.splice(chatIndex, 1)[0] };
                updatedChat.last_message = newMsg.content;
                updatedChat.last_message_time = newMsg.created_at;
                
                // Open, being watched, on screen AND at the live end — the only
                // case where it is about to be read on sight. A thread sitting
                // open in a backgrounded tab has not been read, so it keeps its
                // badge — otherwise the sidebar and the divider would disagree
                // about the same messages. Nor has one scrolled up into the
                // backlog, or hidden behind the inbox list on a phone: READ ON
                // SIGHT sets the badge to what is left once they get there.
                const isChatActive =
                  chat &&
                  chat.product_id === newMsg.product_id &&
                  chat.contact_id === newMsg.sender_id &&
                  isWatchingRef.current &&
                  isAtBottomRef.current &&
                  !!messagesContainerRef.current?.clientHeight;

                if (newMsg.receiver_id === myId && !isChatActive) {
                  updatedChat.unread_count = Number(updatedChat.unread_count || 0) + 1;
                }
              }
              if (updatedChat) updatedInbox.unshift(updatedChat);
              return updatedInbox;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
    // 👈 MAGIC FIX: the socket still opens ONCE and never drops messages.
    // `sessionReady` only goes false→true while this page is mounted, so this is
    // a one-shot deferral, not a resubscribe loop.
  }, [sessionReady]);

  /* ── Send Message ── */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const clientTag = newClientTag();
    const draft = {
      id: clientTag,
      client_tag: clientTag,
      sender_id: currentUserId,
      receiver_id: activeChat.contact_id,
      product_id: activeChat.product_id,
      content: newMessage,
      created_at: new Date().toISOString(),
      is_read: false,
      is_delivered: false,
    };
    setNewMessage("");
    setShowEmojiPicker(false);

    if (isDemoUser) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 5000);
    }

    deliver(draft);
  };

  /* Tapping "Failed to send": the same message, the same bubble, back through
     the automatic retries. */
  const handleRetry = (msg) => {
    if (msg.pending) return;
    deliver(msg);
  };

  /* `unsentRef` (declared with the other refs) is threadKey → (client_tag →
     message). */
  const keepUnsent = (msg) => {
    const key = threadKey(msg.receiver_id, msg.product_id);
    const thread = new Map(unsentRef.current.get(key));
    thread.set(msg.client_tag, msg);
    unsentRef.current.set(key, thread);
  };

  const dropUnsent = (msg) => {
    const key = threadKey(msg.receiver_id, msg.product_id);
    const thread = unsentRef.current.get(key);
    if (!thread) return;
    thread.delete(msg.client_tag);
    if (thread.size === 0) unsentRef.current.delete(key);
  };

  /* Is this message's conversation the one on screen right now? The answer
     can change while a send is in flight. */
  const isOpenThread = (msg) => {
    const chat = activeChatRef.current;
    return (
      !!chat &&
      chat.contact_id === msg.receiver_id &&
      chat.product_id === msg.product_id
    );
  };

  /* Show the message at once (clock), then queue it behind any earlier send
     in the same conversation, so messages arrive in the order typed and a
     retrying one can't be overtaken. Mobile does this with a mutation `scope`. */
  const deliver = (draft) => {
    const sending = { ...draft, pending: true, failed: false };
    keepUnsent(sending);
    if (isOpenThread(sending)) {
      setMessages((prev) => {
        const at = prev.findIndex((m) => m.client_tag === sending.client_tag);
        if (at === -1) return [...prev, sending];
        const next = [...prev];
        next[at] = sending;
        return next;
      });
    }

    const key = threadKey(sending.receiver_id, sending.product_id);
    const run = () => sendWithRetries(sending);
    const queued = (sendQueueRef.current.get(key) ?? Promise.resolve()).then(run, run);
    sendQueueRef.current.set(key, queued);
    queued.finally(() => {
      if (sendQueueRef.current.get(key) === queued) sendQueueRef.current.delete(key);
    });
  };

  /* One POST, with the timeout. Resolves { message } or throws an Error
     carrying `status` (absent when there was no answer at all). */
  const postMessage = async (msg) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE_URL}/messages/send`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(authHeaderToken() ? { Authorization: `Bearer ${authHeaderToken()}` } : {}),
        },
        body: JSON.stringify({
          sender_id: currentUserId,
          receiver_id: msg.receiver_id,
          product_id: msg.product_id,
          content: msg.content,
        }),
      });
      const data = await res.json().catch(() => null);
      // Branch on the code, never the sentence.
      if (!res.ok || !data?.message) {
        throw Object.assign(new Error(`${res.status} ${data?.error ?? "no body"}`), {
          status: res.status,
        });
      }
      return data.message;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`timed out after ${SEND_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  /* The automatic retry (spec §2). The bubble keeps its clock throughout. */
  const sendWithRetries = async (sending) => {
    const tag = sending.client_tag;
    const key = threadKey(sending.receiver_id, sending.product_id);
    for (let failures = 0; ; ) {
      // Realtime already brought the real row in: an earlier try reached the
      // server and only its answer got lost. Sending again would post it twice.
      if (!unsentRef.current.get(key)?.has(tag)) return;

      // Offline: wait for the browser to come back. Costs no try.
      if (!navigator.onLine) {
        await waitForOnline();
        continue;
      }

      try {
        const message = await postMessage(sending);
        dropUnsent(sending);
        if (isOpenThread(sending)) {
          // The bubble already slid in under its client_tag. Its key changes
          // to the server id now, which remounts it; don't play the entrance
          // twice.
          openingIdsRef.current.add(message.id);
          setMessages((prev) => mergeServerMessage(prev, message, tag));
        }
        return;
      } catch (error) {
        failures += 1;
        if (failures <= SEND_MAX_RETRIES && isRetryableSendError(error)) {
          const wait = sendRetryDelay(failures - 1);
          console.info(
            `[send] try ${failures} failed (${error.message}); retrying in ${wait / 1000}s`,
          );
          await sleep(wait);
          continue;
        }
        console.error(`[send] gave up (${tag}): ${error.message}`);
        // Still waiting? (Realtime may have claimed it during the last try.)
        if (!unsentRef.current.get(key)?.has(tag)) return;
        const failed = { ...sending, pending: false, failed: true };
        keepUnsent(failed);
        setMessages((prev) =>
          prev.map((m) => (m.client_tag === tag ? failed : m)),
        );
        return;
      }
    }
  };

  /* ── Emoji insert ── */
  const handleEmojiClick = (emoji) => {
    // maxLength only stops typing and pasting; text set from code skips it.
    // Refuse the whole emoji rather than cut it in half.
    setNewMessage((prev) =>
      prev.length + emoji.length > MAX_MESSAGE_LENGTH ? prev : prev + emoji,
    );
    chatInputRef.current?.focus();
  };

  /* ── Filtered inbox for search ── */
  const filteredInbox = inbox.filter(
    (chat) =>
      !searchQuery ||
      chat.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.product_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.last_message?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  /* Inbox subtitle (spec §1 "Header"). Counts the conversations loaded so
     far, the same as mobile. */
  const unreadConversations = inbox.filter(
    (chat) => Number(chat.unread_count || 0) > 0,
  ).length;

  /* ── Group messages by date ── */
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDayLabel(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  /* ── Loading state ──
     Spec §1 "Loading": skeleton rows (avatar circle + two bars), never a
     spinner. A static copy of the layout with no refs attached, so nothing the
     live page measures or observes exists until the inbox has arrived. */
  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.container}>
          <div className={styles.inboxSidebar} aria-busy="true">
            <div className={styles.inboxHeader}>
              <h2 className={styles.inboxTitle}>Messages</h2>
            </div>
            <div className={styles.searchBar} aria-hidden="true">
              <Search size={15} className={styles.searchIcon} />
              <span className={styles.searchPlaceholder}>
                Search conversations
              </span>
            </div>
            <div className={styles.inboxList}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={styles.skeletonRow}>
                  <span className={styles.skeletonAvatar} />
                  <span className={styles.skeletonBody}>
                    <span className={styles.skeletonBarName} />
                    <span className={styles.skeletonBarPreview} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className={`${styles.chatArea} ${styles.hideOnMobile}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* ════════════ INBOX SIDEBAR ════════════ */}
        <div
          className={`${styles.inboxSidebar} ${!showInboxOnMobile ? styles.hideOnMobile : ""}`}
        >
          {/* Sidebar Header — spec §1 "Header" */}
          <div className={styles.inboxHeader}>
            <h2 className={styles.inboxTitle}>Messages</h2>
            {unreadConversations > 0 && (
              <p className={styles.inboxSubtitle}>
                {unreadConversations} unread conversation
                {unreadConversations === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {/* Filter field — a client-side filter over the loaded inbox
              (filteredInbox), never a server search. */}
          <div className={styles.searchBar}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                className={styles.clearSearchBtn}
                onClick={() => setSearchQuery("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Inbox List */}
          <div className={styles.inboxList} ref={setInboxListEl}>
            {filteredInbox.length === 0 ? (
              <div className={styles.emptyInbox}>
                {searchQuery ? (
                  <>
                    <Search size={28} />
                    <p>
                      No results for "<strong>{searchQuery}</strong>"
                    </p>
                    <span>Try a different name or keyword</span>
                  </>
                ) : (
                  <>
                    <div className={styles.emptyInboxIcon}>
                      <MessageSquare size={28} />
                    </div>
                    <p>No conversations yet</p>
                    <span>
                      Browse the marketplace and message a seller to get
                      started!
                    </span>
                  </>
                )}
              </div>
            ) : (
              filteredInbox.map((chat, idx) => {
                const isActive =
                  activeChat?.product_id === chat.product_id &&
                  activeChat?.contact_id === chat.contact_id;

                const isOnline =
                  isDemoUser ||
                  (onlineUsers.has(chat.contact_id) &&
                    chat.contact_id !== currentUserId);

                const unread = Number(chat?.unread_count || 0);

                return (
                  <div
                    key={`${chat.contact_id}-${chat.product_id}`}
                    className={`${styles.inboxItem} ${isActive ? styles.inboxItemActive : ""} ${
                      unread > 0 ? styles.inboxItemUnread : ""
                    }`}
                    onClick={() => handleSelectChat(chat)}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className={styles.avatarWrap}>
                      <AvatarImg
                        src={chat?.contact_avatar}
                        name={chat?.contact_name}
                        size={48}
                        className={styles.inboxAvatar}
                      />
                    </div>

                    <div className={styles.inboxItemContent}>
                      <div className={styles.inboxItemTop}>
                        <div className={styles.inboxNameRow}>
                          <span className={styles.inboxName}>
                            {chat?.contact_name || "Unknown"}
                            {chat?.contact_id === currentUserId ? " (You)" : ""}
                          </span>
                          {isOnline && (
                            <span className={styles.onlineDot} title="Online" />
                          )}
                        </div>
                        <span className={styles.inboxTime}>
                          {formatInboxTime(chat?.last_message_time)}
                        </span>
                      </div>

                      <div className={styles.inboxItemBottom}>
                        <span className={styles.inboxPreview}>
                          {chat?.last_message || "Start the conversation ✨"}
                        </span>
                        {unread > 0 && (
                          <span className={styles.unreadBadge}>
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>

                      {/* The listing this conversation is about. */}
                      <span className={styles.inboxProductChip}>
                        {chat?.product_title || "Item"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {/* 📄 Block N-C. Bottom of the list, the ordinary way round: this
                list grows downward, so the sentinel goes last. Rendered only
                while `next_cursor` is non-null, which is also why there is no
                "that's everyone" line — it simply stops. */}
            {hasMoreInbox && (
              <InfiniteScrollSentinel
                sentinelRef={inboxSentinelRef}
                loading={loadingMoreInbox}
                label="Loading more conversations"
              />
            )}
          </div>
        </div>

        {/* ════════════ CHAT AREA ════════════ */}
        <div
          className={`${styles.chatArea} ${showInboxOnMobile ? styles.hideOnMobile : ""}`}
        >
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className={styles.chatHeader}>
                <button
                  className={styles.mobileBackBtn}
                  onClick={() => {
                    setShowInboxOnMobile(true);
                    // Going back to the list is an explicit "close this
                    // thread", so don't reopen it on the next visit either.
                    localStorage.removeItem(ACTIVE_CHAT_KEY);
                    navigate("/messages", { replace: true });
                  }}
                >
                  <ChevronLeft size={22} />
                </button>

                <div className={styles.chatHeaderAvatarWrap}>
                  <AvatarImg
                    src={activeChat?.contact_avatar}
                    name={activeChat?.contact_name}
                    size={36}
                    className={styles.chatHeaderAvatar}
                  />
                  {(isDemoUser ||
                    (onlineUsers.has(activeChat.contact_id) &&
                      activeChat.contact_id !== currentUserId)) && (
                    <span className={styles.chatOnlinePip} />
                  )}
                </div>

                <div className={styles.chatHeaderInfo}>
                  <h3 className={styles.chatHeaderName}>
                    {activeChat?.contact_name || "Unknown"}
                    {activeChat?.contact_id === currentUserId ? " (You)" : ""}
                  </h3>

                  {/* Spec §2: "<University> · online". The web has no
                      university name on hand (the inbox RPC doesn't return
                      one), so only the online half shows. */}
                  {(isDemoUser ||
                    (onlineUsers.has(activeChat.contact_id) &&
                      activeChat.contact_id !== currentUserId)) && (
                    <p className={styles.chatHeaderStatus}>online</p>
                  )}
                </div>
              </div>

              {/* Product snippet — spec §2: its own row below the header, on
                  the same white surface. */}
              <div className={styles.chatSnippetBar}>
                <button
                  className={styles.chatProductSnippet}
                  onClick={() => navigate(`/product/${activeChat.product_id}`)}
                >
                  <img
                    src={
                      activeChat?.product_image ||
                      "https://via.placeholder.com/30"
                    }
                    alt=""
                    className={styles.chatProductImg}
                  />
                  <span className={styles.chatProductTitle}>
                    {activeChat?.product_title || "Item"}
                  </span>
                  <ChevronRight size={13} className={styles.chatProductArrow} />
                </button>
              </div>

              {/* Messages Container. Wrapped so the jump button can sit over
                  the thread without scrolling with it. */}
              <div className={styles.threadWrap}>
              <div
                className={styles.messagesContainer}
                ref={attachMessagesContainer}
                onScroll={handleMessagesScroll}
              >
                {/* 📄 Block N-C. THE SENTINEL GOES AT THE TOP, because this is
                    the only list in the app that pages backwards: the oldest
                    message is at the top, the thread opens at the bottom, and
                    "load more" means scrolling UP into history. A bottom
                    sentinel here would sit against the newest message and fire
                    the moment the thread opened.

                    `reserveSpace` keeps the spinner's row in the layout even
                    when it is empty. Everything below this point is the
                    conversation, so a row that appears when the fetch starts
                    would shove the whole thread down before a single message
                    had arrived. */}
                {hasOlder && (
                  <InfiniteScrollSentinel
                    sentinelRef={olderMessagesSentinelRef}
                    loading={loadingOlder}
                    label="Loading older messages"
                    reserveSpace
                  />
                )}

                {/* Welcome message at top. Held back while there is still
                    history to load: "this is the beginning of your
                    conversation" sitting above a thread with 200 older
                    messages under it is simply untrue. Once `next_cursor` is
                    null this IS the beginning, and it reappears. */}
                {!hasOlder && (
                  <div className={styles.chatWelcomeBanner}>
                    <div className={styles.chatWelcomeIcon}>
                      <Users size={18} />
                    </div>
                    <p>
                      This is the beginning of your conversation with{" "}
                      <strong>
                        {activeChat?.contact_id === currentUserId
                          ? "yourself"
                          : activeChat?.contact_name?.split(" ")[0]}
                      </strong>{" "}
                      about <strong>{activeChat?.product_title}</strong>. Be
                      respectful and transact safely on campus! 🎓
                    </p>
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className={styles.emptyChat}>
                    {/* Still frame under reduced motion: a browser cannot pause
                        an animated WebP inside an <img>. */}
                    <picture>
                      <source
                        srcSet={welcomeSticker.still}
                        media="(prefers-reduced-motion: reduce)"
                      />
                      <img
                        src={welcomeSticker.animated}
                        width={120}
                        height={120}
                        alt=""
                        loading="lazy"
                        className={styles.welcomeSticker}
                      />
                    </picture>
                    <p>
                      Say hello to{" "}
                      <strong>
                        {activeChat?.contact_id === currentUserId
                          ? "yourself"
                          : activeChat?.contact_name?.split(" ")[0] || "them"}
                      </strong>
                      !
                    </p>
                    <div className={styles.emptyChatSuggestions}>
                      {[
                        "Hi! Is this still available? 😊",
                        "What's the condition?",
                        "Can we meet on campus?",
                      ].map((s) => (
                        <button
                          key={s}
                          className={styles.suggestionChip}
                          onClick={() => setNewMessage(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  Object.entries(groupedMessages).map(([date, msgs]) => (
                    <React.Fragment key={date}>
                      {/* Date chip — spec §2: a centred pill, no lines. */}
                      <div className={styles.dateSeparator}>
                        <span className={styles.dateSeparatorText}>
                          {date}
                        </span>
                      </div>

                      {msgs.map((msg, index) => {
                        const isMine = msg.sender_id === currentUserId;

                        // A run (spec §2): same sender, same day, each within
                        // 5 minutes of the previous — isGroupedWith, shared
                        // with mobile. Only the last bubble in a run keeps the
                        // tail and the avatar. The unread band also breaks a
                        // run, so a block never appears to straddle the seam.
                        const prevMsg = msgs[index - 1];
                        const nextMsg = msgs[index + 1];
                        const isRunStart =
                          !prevMsg ||
                          !isGroupedWith(prevMsg, msg) ||
                          msg.id === unreadMarker?.id;
                        const isRunEnd =
                          !nextMsg ||
                          !isGroupedWith(msg, nextMsg) ||
                          nextMsg.id === unreadMarker?.id;

                        // Spec §2 "Ticks": failed ⓘ 12 in --chat-failed-tick,
                        // sending 🕒 11, sent ✓ 14, delivered ✓✓ 15, read ✓✓
                        // 15 in --chat-read-tick.
                        let tickIcon = (
                          <Check size={14} className={styles.tickSent} />
                        );

                        if (msg.failed) {
                          tickIcon = (
                            <AlertCircle
                              size={12}
                              className={styles.tickFailed}
                              aria-label="Not sent"
                            />
                          );
                        } else if (msg.pending) {
                          tickIcon = (
                            <Clock
                              size={11}
                              className={styles.tickSent}
                              aria-label="Sending"
                            />
                          );
                        } else if (msg.is_read) {
                          tickIcon = (
                            <CheckCheck size={15} className={styles.tickRead} />
                          );
                        } else if (
                          msg.is_delivered ||
                          onlineUsers.has(activeChat.contact_id)
                        ) {
                          tickIcon = (
                            <CheckCheck
                              size={15}
                              className={styles.tickDelivered}
                            />
                          );
                        }

                        return (
                          <React.Fragment key={msg.id || index}>
                            {/* WhatsApp-style unread line. `unreadMarker` is
                                pinned when the thread opens, so this stays put
                                as the messages under it get marked read. */}
                            {unreadMarker?.id === msg.id && (
                              <div
                                className={styles.unreadDivider}
                                ref={unreadDividerRef}
                              >
                                {unreadMarker.count} unread message
                                {unreadMarker.count > 1 ? "s" : ""}
                              </div>
                            )}
                            <div
                              /* 📄 Block N-C. What the scroll compensation
                                 anchors on when a page of older messages is
                                 prepended — see `measureAnchor`. */
                              data-msg-id={msg.id}
                              className={`${styles.messageWrapper} ${isMine ? styles.messageMine : styles.messageTheirs} ${
                                isRunStart ? styles.runStart : ""
                              } ${isRunEnd ? styles.runEnd : ""} ${
                                openingIdsRef.current.has(msg.id)
                                  ? ""
                                  : styles.messageEnter
                              }`}
                            >
                              {!isMine &&
                                (isRunEnd ? (
                                  <AvatarImg
                                    src={activeChat?.contact_avatar}
                                    name={activeChat?.contact_name}
                                    size={28}
                                    className={styles.messageAvatar}
                                  />
                                ) : (
                                  // Holds the column so stacked bubbles stay
                                  // aligned with the one that has the avatar.
                                  <span className={styles.avatarSpacer} />
                                ))}
                              <div
                                className={`${styles.messageBubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${
                                  msg.failed ? styles.bubbleFailed : ""
                                }`}
                              >
                                <MessageText content={msg.content} />
                                <div className={styles.messageMeta}>
                                  <span className={styles.messageTime}>
                                    {formatClockTime(msg.created_at)}
                                  </span>
                                  {isMine && (
                                    <span className={styles.readReceipt}>
                                      {tickIcon}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Spec §2 "Failed message": under the bubble,
                                right-aligned. Shown only once the automatic
                                retries have given up; tapping starts them
                                again for the same message. */}
                            {msg.failed && (
                              <button
                                type="button"
                                className={styles.retryPill}
                                onClick={() => handleRetry(msg)}
                                aria-label="Message not sent. Tap to try again"
                              >
                                <RotateCw size={11} aria-hidden="true" />
                                Failed to send
                              </button>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}

                {isTyping && (
                  <div
                    className={styles.messageWrapper}
                    style={{
                      justifyContent: "flex-start",
                      animation: "fadeIn 0.3s ease",
                    }}
                  >
                    <AvatarImg
                      src={activeChat?.contact_avatar}
                      name={activeChat?.contact_name}
                      size={28}
                      className={styles.messageAvatar}
                    />
                    <div
                      className={`${styles.messageBubble} ${styles.bubbleTheirs} ${styles.typingBubble}`}
                    >
                      <div className={styles.typingDots}>
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                )}
              </div>

                {/* Jump to latest. Always mounted while there are messages, so
                    it can animate out as well as in; hidden, it takes no clicks
                    and leaves the tab order. */}
                {messages.length > 0 && (
                  <div
                    className={`${styles.jumpWrap} ${scrolledUp ? styles.jumpVisible : ""}`}
                    aria-hidden={!scrolledUp}
                  >
                    <button
                      type="button"
                      className={styles.jumpBtn}
                      onClick={() => scrollToBottom("smooth")}
                      tabIndex={scrolledUp ? 0 : -1}
                      aria-label={
                        newBelow > 0
                          ? `${newBelow} new message${newBelow > 1 ? "s" : ""}. Jump to latest`
                          : "Jump to latest message"
                      }
                    >
                      <ChevronsDown size={20} />
                    </button>
                    {newBelow > 0 && (
                      <span className={styles.jumpBadge} aria-hidden="true">
                        {newBelow > 99 ? "99+" : newBelow}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input Area */}
              <div className={styles.chatInputArea}>
                <div
                  className={styles.emojiPickerContainer}
                  ref={emojiPickerRef}
                >
                  <button
                    type="button"
                    className={`${styles.emojiToggleBtn} ${showEmojiPicker ? styles.emojiToggleActive : ""}`}
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    title="Emoji"
                  >
                    <Smile size={20} />
                  </button>

                  {showEmojiPicker && (
                    <div className={styles.emojiPicker}>
                      <div className={styles.emojiTabs}>
                        {EMOJI_ROWS.map((row, i) => (
                          <button
                            key={row.label}
                            className={`${styles.emojiTab} ${activeEmojiRow === i ? styles.emojiTabActive : ""}`}
                            onClick={() => setActiveEmojiRow(i)}
                          >
                            {row.emojis[0]} {row.label}
                          </button>
                        ))}
                      </div>
                      <div className={styles.emojiGrid}>
                        {EMOJI_ROWS[activeEmojiRow].emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className={styles.emojiBtn}
                            onClick={() => handleEmojiClick(emoji)}
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <form className={styles.chatForm} onSubmit={handleSendMessage}>
                  {/* A textarea, not an <input>: Chrome on Android shows its
                      autofill bar (passwords, cards, addresses) above the
                      keyboard for text inputs even with autocomplete off. It
                      also lets the box grow to 5 lines (spec §2 Composer). */}
                  <textarea
                    ref={chatInputRef}
                    rows={1}
                    autoComplete="off"
                    placeholder="Message"
                    maxLength={MAX_MESSAGE_LENGTH}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      // Desktop: Enter sends, Shift+Enter is a new line. Touch
                      // keyboards: Enter is a new line and the button sends,
                      // as in WhatsApp. Never mid-IME composition.
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing &&
                        !window.matchMedia("(pointer: coarse)").matches
                      ) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    className={styles.chatInput}
                    onFocus={() => setShowEmojiPicker(false)}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className={`${styles.sendBtn} ${newMessage.trim() ? styles.sendBtnActive : ""}`}
                    // Don't take focus from the message box. On a phone that
                    // blur closed the keyboard after every send, dropping the
                    // composer to the bottom of the screen. WhatsApp keeps the
                    // keyboard up so you can keep typing; so does this.
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Send size={17} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className={styles.noActiveChat}>
              <div className={styles.noChatDecor}>
                <div className={styles.noChatOrb1} />
                <div className={styles.noChatOrb2} />
                <div className={styles.noChatOrb3} />
              </div>
              <div className={styles.noChatIconWrap}>
                <MessageSquare size={36} strokeWidth={1.5} />
              </div>
              <h3 className={styles.noChatTitle}>Your Conversations</h3>
              <p className={styles.noChatSubtitle}>
                Connect with fellow students. Buy, sell, and
                <br />
                chat safely within your campus community.
              </p>
              <div className={styles.noChatTips}>
                <div className={styles.noChatTip}>
                  <span>💡</span> Ask about item condition or price
                </div>
                <div className={styles.noChatTip}>
                  <span>📍</span> Arrange a safe campus meetup
                </div>
                <div className={styles.noChatTip}>
                  <span>🤝</span> Negotiate and close the deal
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 