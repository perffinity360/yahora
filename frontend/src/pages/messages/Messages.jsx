// frontend/src/pages/messages/Messages.jsx
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./Messages.module.css";
import { supabase } from "../../config/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  Check,
  CheckCheck,
  Search,
  X,
  Smile,
  Sparkles,
  Users,
} from "lucide-react";
import { API_BASE_URL } from '../../config/urls';


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

/* ── Time formatter ── */
const formatTime = (isoString) => {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

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

  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const activeChatRef = useRef(activeChat);
  const currentUserIdRef = useRef(currentUserId);
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

  /* ?user=&product= as they were on the FIRST render. Captured in a ref so the
     inbox effect below can stay out of `searchParams` — see the note there. */
  const deepLinkRef = useRef({
    user: searchParams.get("user"),
    product: searchParams.get("product"),
  });

  const scrollToBottom = (behavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    isAtBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      BOTTOM_STICK_THRESHOLD;
  };

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
      // The divider is the whole point of the anchored open; without one there
      // is nothing unread, so the live end of the thread is where to land.
      if (!anchorToUnreadDivider()) {
        scrollToBottom("auto");
        isAtBottomRef.current = true;
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
    if (isMine || (isWatchingRef.current && isAtBottomRef.current)) {
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
     the visible unread line, and only now tell the server they were read. */
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
    setUnreadMarker(pending);
    pendingReturnAnchorRef.current = true;

    const chat = activeChatRef.current;
    const myId = currentUserIdRef.current;
    if (!chat || !myId) return;

    // The receipt is honest now that the messages are back on screen. It does
    // not erase the line: `unreadMarker` is pinned state, not something derived
    // from `is_read` — see the note on that state.
    fetch(`${API_BASE_URL}/messages/read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: myId,
        contactId: chat.contact_id,
        productId: chat.product_id,
      }),
    }).catch((error) =>
      console.error("Failed to mark messages read on return:", error),
    );

    setInbox((prev) =>
      prev.map((c) =>
        c.contact_id === chat.contact_id && c.product_id === chat.product_id
          ? { ...c, unread_count: 0 }
          : c,
      ),
    );
  };

  /* ── Are they actually looking at this? ──
     A message that arrives while the tab is hidden or the window is behind
     something else has not been seen, so marking it read the moment it lands —
     which is what the realtime handler does — is a lie, and it costs this
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
      if (watching) flushAwayUnread();
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
        );
        const data = await res.json();
        let fetchedInbox = data.inbox || [];

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
      const history = data.messages || [];
      openingIdsRef.current = new Set(history.map((m) => m.id));
      setMessages(history);

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

      if (chat.unread_count > 0) {
        await fetch(`${API_BASE_URL}/messages/read`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUserId,
            contactId: chat.contact_id,
            productId: chat.product_id,
          }),
        });

        setInbox((prev) =>
          prev.map((c) =>
            c.contact_id === chat.contact_id && c.product_id === chat.product_id
              ? { ...c, unread_count: 0 }
              : c,
          ),
        );
      }
    } catch (error) {
      // Clear on failure. Leaving the previous chat's messages on screen under
      // the newly selected contact's header would render one student's
      // conversation as if it belonged to another — worse than showing nothing.
      setMessages([]);
      setUnreadMarker(null);
      awayUnreadRef.current = null;
      openingIdsRef.current = new Set();
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
              // Prevent duplicate messages
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              
              if (newMsg.receiver_id === myId) {
                if (isWatchingRef.current) {
                  // They are on the thread with their eyes on it — this one is
                  // genuinely read the moment it lands, and gets no divider.
                  fetch(`${API_BASE_URL}/messages/read`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: myId,
                      contactId: newMsg.sender_id,
                      productId: newMsg.product_id,
                    }),
                  });
                } else {
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
                updatedChat = updatedInbox.splice(chatIndex, 1)[0];
                updatedChat.last_message = newMsg.content;
                updatedChat.last_message_time = newMsg.created_at;
                
                // Open AND being watched. A thread sitting open in a
                // backgrounded tab has not been read, so it keeps its badge —
                // otherwise the sidebar and the divider would disagree about
                // the same messages.
                const isChatActive =
                  chat &&
                  chat.product_id === newMsg.product_id &&
                  chat.contact_id === newMsg.sender_id &&
                  isWatchingRef.current;

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

    const tempMessage = newMessage;
    setNewMessage("");
    setShowEmojiPicker(false);

    if (isDemoUser) {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 5000);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: currentUserId,
          receiver_id: activeChat.contact_id,
          product_id: activeChat.product_id,
          content: tempMessage,
        }),
      });

      const data = await res.json();

      if (res.ok && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  /* ── Emoji insert ── */
  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji);
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

  /* ── Group messages by date ── */
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading your conversations…</p>
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
          {/* Sidebar Header */}
          <div className={styles.inboxHeader}>
            <div className={styles.inboxHeaderTop}>
              <div className={styles.inboxTitleRow}>
                <h2 className={styles.inboxTitle}>Messages</h2>
              </div>
              <Sparkles size={16} className={styles.headerSparkle} />
            </div>

            {/* Search Bar */}
            <div className={styles.searchBar}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search conversations…"
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
          </div>

          {/* Inbox List */}
          <div className={styles.inboxList}>
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

                return (
                  <div
                    key={`${chat.contact_id}-${chat.product_id}`}
                    className={`${styles.inboxItem} ${isActive ? styles.inboxItemActive : ""}`}
                    onClick={() => handleSelectChat(chat)}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className={styles.avatarWrap}>
                      <AvatarImg
                        src={chat?.contact_avatar}
                        name={chat?.contact_name}
                        size={46}
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
                          {formatTime(chat?.last_message_time)}
                        </span>
                      </div>

                      <div className={styles.inboxProductChip}>
                        <img
                          src={
                            chat?.product_image ||
                            "https://via.placeholder.com/20"
                          }
                          alt={chat?.product_title || "Item"}
                          className={styles.inboxChipImg}
                        />
                        <span>{chat?.product_title || "Item"}</span>
                      </div>

                      <div className={styles.inboxItemBottom}>
                        <span
                          className={`${styles.inboxPreview} ${chat?.unread_count > 0 ? styles.inboxPreviewBold : ""}`}
                        >
                          {chat?.last_message || "Start the conversation ✨"}
                        </span>
                        {chat?.unread_count > 0 && (
                          <span className={styles.unreadBadge}>
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
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
                  <ArrowLeft size={19} />
                </button>

                <div className={styles.chatHeaderAvatarWrap}>
                  <AvatarImg
                    src={activeChat?.contact_avatar}
                    name={activeChat?.contact_name}
                    size={42}
                    className={styles.chatHeaderAvatar}
                  />
                  {(isDemoUser ||
                    (onlineUsers.has(activeChat.contact_id) &&
                      activeChat.contact_id !== currentUserId)) && (
                    <span className={styles.chatOnlinePip} />
                  )}
                </div>

                <div className={styles.chatHeaderInfo}>
                  <div className={styles.chatHeaderNameRow}>
                    <h3 className={styles.chatHeaderName}>
                      {activeChat?.contact_name || "Unknown"}
                      {activeChat?.contact_id === currentUserId ? " (You)" : ""}
                    </h3>

                    {(isDemoUser ||
                      (onlineUsers.has(activeChat.contact_id) &&
                        activeChat.contact_id !== currentUserId)) && (
                      <span className={styles.onlineLabel}>
                        <span className={styles.onlineDot} /> Online
                      </span>
                    )}
                  </div>

                  <button
                    className={styles.chatProductSnippet}
                    onClick={() => navigate(`/product/${activeChat.product_id}`)}
                  >
                    <img
                      src={
                        activeChat?.product_image ||
                        "https://via.placeholder.com/20"
                      }
                      alt="Product"
                      className={styles.chatProductImg}
                    />
                    <span className={styles.chatProductTitle}>
                      {activeChat?.product_title || "Item"}
                    </span>
                    <span className={styles.chatProductArrow}>→</span>
                  </button>
                </div>
              </div>

              {/* Messages Container */}
              <div
                className={styles.messagesContainer}
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
              >
                {/* Welcome message at top */}
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

                {messages.length === 0 ? (
                  <div className={styles.emptyChat}>
                    <div className={styles.emptyChatEmoji}>👋</div>
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
                      <div className={styles.dateSeparator}>
                        <span className={styles.dateSeparatorLine} />
                        <span className={styles.dateSeparatorText}>
                          {date}
                        </span>
                        <span className={styles.dateSeparatorLine} />
                      </div>

                      {msgs.map((msg, index) => {
                        const isMine = msg.sender_id === currentUserId;

                        // Consecutive messages from one person read as a single
                        // block: only the last bubble in a run keeps the tail
                        // and the avatar. The unread line also ends a run, so a
                        // block never appears to straddle the seam.
                        const nextMsg = msgs[index + 1];
                        const isRunEnd =
                          !nextMsg ||
                          nextMsg.sender_id !== msg.sender_id ||
                          nextMsg.id === unreadMarker?.id;

                        let tickIcon = (
                          <Check size={13} className={styles.tickSent} />
                        );

                        if (msg.is_read) {
                          tickIcon = (
                            <CheckCheck size={13} className={styles.tickRead} />
                          );
                        } else if (
                          msg.is_delivered ||
                          onlineUsers.has(activeChat.contact_id)
                        ) {
                          tickIcon = (
                            <CheckCheck
                              size={13}
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
                                <span className={styles.unreadDividerLine} />
                                <span className={styles.unreadDividerText}>
                                  {unreadMarker.count} unread message
                                  {unreadMarker.count > 1 ? "s" : ""}
                                </span>
                                <span className={styles.unreadDividerLine} />
                              </div>
                            )}
                            <div
                              className={`${styles.messageWrapper} ${isMine ? styles.messageMine : styles.messageTheirs} ${
                                isRunEnd ? styles.runEnd : ""
                              } ${
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
                                className={`${styles.messageBubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs}`}
                              >
                                <p className={styles.messageText}>{msg.content}</p>
                                <div className={styles.messageMeta}>
                                  <span className={styles.messageTime}>
                                    {formatTime(msg.created_at)}
                                  </span>
                                  {isMine && (
                                    <span className={styles.readReceipt}>
                                      {tickIcon}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
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
                  <input
                    ref={chatInputRef}
                    type="text"
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className={styles.chatInput}
                    onFocus={() => setShowEmojiPicker(false)}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className={`${styles.sendBtn} ${newMessage.trim() ? styles.sendBtnActive : ""}`}
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