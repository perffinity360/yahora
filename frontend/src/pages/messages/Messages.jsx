// frontend/src/pages/messages/Messages.jsx
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import styles from "./Messages.module.css";
import { supabase } from "../../config/supabaseClient";
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

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

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
  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const activeChatRef = useRef(activeChat);
  const currentUserIdRef = useRef(currentUserId);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => scrollToBottom(), [messages]);

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

  /* ── 1. Fetch Inbox & Handle URL Persistence ── */
  useEffect(() => {
    if (!currentUserId) return navigate("/auth");

    const loadInboxAndCheckParams = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/messages/inbox/${currentUserId}`,
        );
        const data = await res.json();
        let fetchedInbox = data.inbox || [];

        const paramUserId = searchParams.get("user");
        const paramProductId = searchParams.get("product");

        if (paramUserId && paramProductId) {
          const existingChat = fetchedInbox.find(
            (chat) =>
              chat.contact_id === paramUserId &&
              chat.product_id === paramProductId,
          );

          if (existingChat) {
            handleSelectChat(existingChat, true);
          } else {
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
  }, [currentUserId, navigate, searchParams]);

  /* ── 2. Select Chat ── */
  const handleSelectChat = async (chat, isInitialLoad = false) => {
    setActiveChat(chat);
    setShowInboxOnMobile(false);
    setShowEmojiPicker(false);

    if (!isInitialLoad) {
      navigate(`/messages?user=${chat.contact_id}&product=${chat.product_id}`, {
        replace: true,
      });
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/messages/history?userId=${currentUserId}&contactId=${chat.contact_id}&productId=${chat.product_id}`,
      );
      const data = await res.json();
      setMessages(data.messages || []);

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
                fetch(`${API_BASE_URL}/messages/read`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: myId,
                    contactId: newMsg.sender_id,
                    productId: newMsg.product_id,
                  }),
                });
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
                
                const isChatActive =
                  chat &&
                  chat.product_id === newMsg.product_id &&
                  chat.contact_id === newMsg.sender_id;
                  
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
  }, []); // 👈 MAGIC FIX: Empty array means the socket opens ONCE and never drops messages!

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
                          <div
                            key={msg.id || index}
                            className={`${styles.messageWrapper} ${isMine ? styles.messageMine : styles.messageTheirs}`}
                          >
                            {!isMine && (
                              <AvatarImg
                                src={activeChat?.contact_avatar}
                                name={activeChat?.contact_name}
                                size={28}
                                className={styles.messageAvatar}
                              />
                            )}
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