// frontend/src/pages/community/Community.jsx
//
// The Community page — docs/design/COMMUNITY_SPEC.md §1.
//
//   ≥ 1024 px  two panels (react-resizable-panels): My campus on the left,
//              a country or Global on the right. Drag, double-click for
//              50 / 50, keyboard on the divider, collapse to a 36 px bar,
//              ⤢ for full width. The layout is remembered. Your avatar rides
//              on the divider, the two composers tucked in under it, and lights
//              up on the side you're writing on. One side is always selected:
//              the left one when the page opens (with the cursor in it if
//              there's a mouse), then whichever composer you last used.
//              Pressing the avatar switches sides.
//   < 1024 px  one feed at a time, with a floating switcher and composer that
//              the posts pass underneath. The site navbar is hidden here too
//              (App.jsx); the brand pill sits in the switcher instead.
//
// Only one layout is mounted (useMediaQuery), so the feeds load once. Both
// layouts offer the same feeds and the same actions (frontend/CLAUDE.md §18).
//
// ⚠ Part 1: everything here runs on ./sampleData.js. Part 2 replaces it with
// the posts API and deletes that file.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  Maximize2,
  Minimize2,
} from "lucide-react";
import AvatarImg from "../../components/AvatarImg/AvatarImg";
import { CampusIcon } from "../../components/community/AnimatedIcons/AnimatedIcons";
import CommunityFeed from "./CommunityFeed";
import BrandMenu from "./BrandMenu";
import CountryMenu, { GLOBAL, WorldGlyph, worldLabel } from "./CountryMenu";
import useMediaQuery from "../../hooks/useMediaQuery";
import { useHistoryEntryState } from "../../hooks/useScrollRestoration";
import {
  LAYOUT_BREAKPOINT_PX,
  LAYOUT_COLLAPSED_PX,
} from "../../utils/community";
import { SAMPLE_COUNTRIES, SAMPLE_VIEWER, sampleReact } from "./sampleData";
import styles from "./Community.module.css";

const LAYOUT_KEY = "yahora.community.layout";
const LEFT = "campus";
const RIGHT = "world";
/* A little longer than the panels' 280 ms transition (Community.module.css). */
const PANEL_ANIMATION_MS = 320;
/* How close to the window's edges the brand pill may sit (BrandMenu.module.css). */
const BRAND_EDGE_PX = 72;
/* A press on the avatar that moves less than this is a click, not a drag. */
const HUB_CLICK_SLOP_PX = 4;

/* The saved layout, or undefined for the 50 / 50 default. Anything that
   doesn't look like our two panels is ignored rather than trusted. */
function readLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (saved && Number.isFinite(saved[LEFT]) && Number.isFinite(saved[RIGHT])) return saved;
  } catch {
    // Private mode, blocked storage or a hand-edited value: use the default.
  }
  return undefined;
}

function saveLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // Not remembering the layout is fine.
  }
}

/** Hot · New (spec §1.1), as two icons, only on the country / Global side. */
function SortSwitch({ sort, onChange }) {
  const options = [
    ["hot", "Hot", Flame],
    ["new", "New", Clock],
  ];
  // The browser's own title tooltip waits over a second and can't be hurried,
  // so the words are our own (data-tip, Community.module.css): after 350 ms of
  // resting there, and not again once the button has been pressed, until the
  // pointer leaves it.
  const [pressed, setPressed] = useState(null);
  return (
    <div className={styles.sortSwitch} role="group" aria-label="Sort posts" data-sort={sort}>
      <span className={styles.sortThumb} aria-hidden="true" />
      {options.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          aria-pressed={sort === value}
          aria-label={label}
          data-tip={label}
          data-quiet={pressed === value || undefined}
          onPointerDown={() => setPressed(value)}
          onPointerLeave={() => setPressed((p) => (p === value ? null : p))}
          className={`${styles.sortBtn} ${sort === value ? styles.sortBtnActive : ""}`}
          onClick={() => onChange(value)}
        >
          <Icon size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** A panel collapsed to its 36 px bar: an expand button and the name written
    vertically (spec §1.1). */
function CollapsedBar({ label, side, onExpand }) {
  const Icon = side === "left" ? ChevronRight : ChevronLeft;
  return (
    <div className={styles.collapsedBar}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onExpand}
        aria-label={`Expand ${label}`}
        title="Expand"
      >
        <Icon size={15} aria-hidden="true" />
      </button>
      <button type="button" className={styles.verticalLabel} onClick={onExpand} tabIndex={-1}>
        {label}
      </button>
    </div>
  );
}

export default function Community() {
  const wide = useMediaQuery(`(min-width: ${LAYOUT_BREAKPOINT_PX}px)`);

  // Part 2: GET /api/posts/countries.
  const countries = SAMPLE_COUNTRIES;
  const myCountry = countries.find((c) => c.is_mine)?.code ?? GLOBAL;
  const campusName = SAMPLE_VIEWER.university;
  const viewer = useMemo(
    () => ({
      username: SAMPLE_VIEWER.username,
      name: SAMPLE_VIEWER.name,
      avatar: SAMPLE_VIEWER.avatar,
      campus: SAMPLE_VIEWER.university,
    }),
    [],
  );

  // View state that changes what is on screen lives in the history entry, so
  // Back returns to the same feed (frontend/CLAUDE.md §13).
  const [world, setWorld] = useHistoryEntryState("communityWorld", myCountry);
  const [sort, setSort] = useHistoryEntryState("communitySort", "hot");
  const [segment, setSegment] = useHistoryEntryState("communitySegment", "campus");

  // Reaction answers by post id, laid over every loaded feed.
  const [patches, setPatches] = useState({});
  const onReact = useCallback((postId, emoji) => {
    // Part 2: optimistic, then api.react / api.unreact, rolled back on error.
    const answer = sampleReact(postId, emoji);
    if (!answer) return;
    setPatches((prev) => ({
      ...prev,
      [postId]: {
        viewer_reaction: answer.viewer_reaction,
        reactions_total: answer.reactions_total,
        reaction_counts: answer.reaction_counts,
      },
    }));
  }, []);

  const worldName = worldLabel(world, countries);

  // Spec §9: the words for each feed.
  const campusFeed = {
    kind: "campus",
    emptyText: `No posts from ${campusName} yet. Be the first to say hello.`,
  };
  const worldFeed =
    world === GLOBAL
      ? {
          kind: "global",
          emptyText: "Nothing here yet. Start the conversation.",
        }
      : {
          kind: "country",
          country: world,
          countryName: worldName,
          emptyText:
            world === myCountry
              ? `No posts from students in ${worldName} yet. Start the conversation.`
              : `No posts from students in ${worldName} yet.`,
          viewOnlyName: worldName,
        };

  const shared = { patches, onReact, viewer };

  return wide ? (
    <WideLayout
      campusName={campusName}
      campusFeed={campusFeed}
      worldFeed={worldFeed}
      world={world}
      setWorld={setWorld}
      sort={sort}
      setSort={setSort}
      countries={countries}
      viewer={viewer}
      shared={shared}
    />
  ) : (
    <NarrowLayout
      campusFeed={campusFeed}
      worldFeed={worldFeed}
      world={world}
      setWorld={setWorld}
      sort={sort}
      setSort={setSort}
      segment={segment}
      setSegment={setSegment}
      countries={countries}
      shared={shared}
    />
  );
}

/* ── ≥ 1024 px: two panels ─────────────────────────────────────────────── */

function WideLayout({
  campusName,
  campusFeed,
  worldFeed,
  world,
  setWorld,
  sort,
  setSort,
  countries,
  viewer,
  shared,
}) {
  const leftRef = usePanelRef();
  const rightRef = usePanelRef();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animationTimer = useRef(null);
  const defaultLayout = useMemo(readLayout, []);

  // The side you're writing on (spec §1.1). It stays selected when you click
  // away, so the avatar and that composer always say where a post would go.
  const [selectedSide, setSelectedSide] = useState("left");
  const [rightCanPost, setRightCanPost] = useState(null); // null while loading
  const [focusSignals, setFocusSignals] = useState({ left: 0, right: 0 });
  const onLeftActive = useCallback((on) => on && setSelectedSide("left"), []);
  const onRightActive = useCallback((on) => on && setSelectedSide("right"), []);
  // A side can be selected only while its composer is there: not collapsed,
  // and not another country's view-only feed.
  const available = { left: !leftCollapsed, right: !rightCollapsed && rightCanPost !== false };
  const side = available[selectedSide]
    ? selectedSide
    : available.left
      ? "left"
      : available.right
        ? "right"
        : null;
  const otherSide = side === "left" ? "right" : "left";

  // When the page opens, the cursor waits in the campus composer. Only with a
  // mouse: on a touch screen it would raise the keyboard (frontend/CLAUDE.md §18).
  const [focusOnOpen] = useState(() => window.matchMedia("(pointer: fine)").matches);

  // The avatar is much wider than the divider, and the library only starts a drag
  // on the divider itself, so a press on the rest of the avatar drags from here.
  // A press that doesn't move is a click, and switches sides.
  const hubDrag = useRef(null);
  const [hubDragging, setHubDragging] = useState(false);
  const onHubDown = (e) => {
    const left = leftRef.current;
    if (!left || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    hubDrag.current = { x: e.clientX, size: left.getSize().inPixels, moved: false };
  };
  const onHubMove = (e) => {
    const drag = hubDrag.current;
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < HUB_CLICK_SLOP_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      setHubDragging(true);
    }
    leftRef.current?.resize(drag.size + e.clientX - drag.x);
  };
  const onHubUp = (e) => {
    const drag = hubDrag.current;
    hubDrag.current = null;
    setHubDragging(false);
    if (!drag || drag.moved || e.type === "pointercancel") return;
    const next = available[otherSide] ? otherSide : side;
    if (!next) return;
    setSelectedSide(next);
    setFocusSignals((s) => ({ ...s, [next]: s[next] + 1 }));
  };

  useEffect(() => () => clearTimeout(animationTimer.current), []);

  // The brand pill (and its menu) sits over the divider's centre. The left
  // panel's width changes on every drag, glide and window resize, so watching
  // it keeps --split-pct exact without re-rendering anything. Near a window edge
  // the pill stops (BRAND_EDGE_PX) while the divider goes on, so it would cover
  // the open header's ⤢: each header's clearance (--head-clear-left/-right) is
  // how far the pill reaches over it, plus a gap.
  const wideRef = useRef(null);
  const separatorRef = useRef(null);
  const leftPanelRef = useRef(null);
  useLayoutEffect(() => {
    const wideEl = wideRef.current;
    const placeBrand = () => {
      const sep = separatorRef.current;
      if (!wideEl || !sep) return;
      const w = wideEl.getBoundingClientRect();
      const s = sep.getBoundingClientRect();
      if (!w.width) return;
      const center = s.left + s.width / 2 - w.left;
      wideEl.style.setProperty("--split-pct", `${(center / w.width) * 100}%`);
      const pill = wideEl.querySelector("[data-brand-pill]");
      const half = (pill?.offsetWidth ?? 0) / 2;
      const pillAt = Math.min(Math.max(center, BRAND_EDGE_PX), w.width - BRAND_EDGE_PX);
      const gap = 8;
      // The left header ends at the divider's left edge, the right one starts
      // at its right edge; each keeps clear of the part of the pill over it.
      const leftHeadEnd = s.left - w.left;
      const rightHeadStart = s.right - w.left;
      wideEl.style.setProperty("--head-clear-left", `${Math.max(0, leftHeadEnd - (pillAt - half)) + gap}px`);
      wideEl.style.setProperty("--head-clear-right", `${Math.max(0, pillAt + half - rightHeadStart) + gap}px`);
    };
    placeBrand();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(placeBrand);
    if (wideEl) ro.observe(wideEl);
    if (leftPanelRef.current) ro.observe(leftPanelRef.current);
    // The unread badge changes the pill's width.
    const pillEl = wideEl?.querySelector("[data-brand-pill]");
    if (pillEl) ro.observe(pillEl);
    return () => ro.disconnect();
  }, []);

  const isCollapsed = (size) => size.inPixels <= LAYOUT_COLLAPSED_PX + 2;

  // The panels glide only for a button press. During a drag they must follow
  // the pointer exactly, so the transition is switched on just for this.
  const glide = () => {
    setAnimating(true);
    clearTimeout(animationTimer.current);
    animationTimer.current = setTimeout(() => setAnimating(false), PANEL_ANIMATION_MS);
  };
  const collapse = (ref) => {
    glide();
    ref.current?.collapse();
  };
  // A panel shut with ⤢ goes back to its old width (the library remembers it).
  // One dragged all the way into its bar was never "collapsed" in the library's
  // sense, so expand() leaves it there; that one opens to half the width.
  const expand = (ref) => {
    const panel = ref.current;
    if (!panel) return;
    glide();
    panel.expand();
    if (panel.getSize().inPixels <= LAYOUT_COLLAPSED_PX + 2) panel.resize("50%");
  };

  // ⤢ opens this panel full width by collapsing the other; pressed again
  // (the other one is collapsed) it restores both.
  const toggleMax = (otherRef) => {
    const other = otherRef.current;
    if (!other) return;
    if (other.isCollapsed() || other.getSize().inPixels <= LAYOUT_COLLAPSED_PX + 2) expand(otherRef);
    else collapse(otherRef);
  };

  const label = worldLabel(world, countries);

  return (
    <div ref={wideRef} className={styles.wide}>
      <BrandMenu />
      <Group
        orientation="horizontal"
        className={`${styles.group} ${animating ? styles.groupGliding : ""}`}
        style={{ overflow: "visible" }}
        defaultLayout={defaultLayout}
        onLayoutChanged={(layout, meta) => saveLayout(meta?.requestedLayout ?? layout)}
      >
        <Panel
          id={LEFT}
          panelRef={leftRef}
          elementRef={leftPanelRef}
          defaultSize="50%"
          minSize={LAYOUT_COLLAPSED_PX}
          collapsible
          collapsedSize={LAYOUT_COLLAPSED_PX}
          onResize={(size) => setLeftCollapsed(isCollapsed(size))}
          className={`${styles.panel} ${styles.panelLeft}`}
          style={{ overflow: "hidden" }}
        >
          {leftCollapsed && (
            <CollapsedBar label="My campus" side="left" onExpand={() => expand(leftRef)} />
          )}
          {/* Kept mounted while collapsed, so expanding again finds the feed
              where it was instead of reloading it. */}
          <section className={styles.panelInner} hidden={leftCollapsed} aria-label="My campus">
            <header className={styles.panelHeader}>
              <div className={styles.panelControls}>
                <h2 className={styles.campusTitle}>
                  <CampusIcon size={17} className={styles.campusIcon} />
                  <span>{campusName}</span>
                </h2>
              </div>
              <div className={styles.panelTools}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => toggleMax(rightRef)}
                  aria-label={rightCollapsed ? "Restore both panels" : "Open My campus full width"}
                  title={rightCollapsed ? "Restore" : "Full width"}
                >
                  {rightCollapsed ? <Minimize2 size={13} aria-hidden="true" /> : <Maximize2 size={13} aria-hidden="true" />}
                </button>
              </div>
            </header>
            <CommunityFeed
              key="campus"
              {...campusFeed}
              inPanel
              side="left"
              onComposerActive={onLeftActive}
              selected={side === "left"}
              focusSignal={focusSignals.left}
              autoFocusComposer={focusOnOpen}
              {...shared}
            />
          </section>
        </Panel>

        {/* The avatar is a child of the divider, so it moves with it for free.
            The badge says where you're writing; the composer's own label says it
            to a screen reader, and Tab reaches both composers, so pressing the
            avatar is only a shortcut for a mouse. */}
        <Separator className={styles.handle} elementRef={separatorRef}>
          <span className={styles.handleGripGlow} aria-hidden="true" />
          <span
            className={styles.hub}
            data-active={side ?? undefined}
            data-dragging={hubDragging || undefined}
            aria-hidden="true"
            title={available[otherSide] ? `Post in ${otherSide === "left" ? "My campus" : label}` : undefined}
            onPointerDown={onHubDown}
            onPointerMove={onHubMove}
            onPointerUp={onHubUp}
            onPointerCancel={onHubUp}
          >
            <span className={`${styles.hubHalf} ${styles.hubHalfLeft}`} />
            <span className={`${styles.hubHalf} ${styles.hubHalfRight}`} />
            <span className={styles.hubPhoto}>
              <AvatarImg src={viewer.avatar} name={viewer.name} size={41} className={styles.hubAvatar} />
            </span>
            <span className={`${styles.hubBadge} ${styles.hubBadgeCampus}`}>
              <GraduationCap size={14} />
            </span>
            <span className={`${styles.hubBadge} ${styles.hubBadgeWorld}`}>
              <WorldGlyph value={world} size={14} />
            </span>
          </span>
        </Separator>

        <Panel
          id={RIGHT}
          panelRef={rightRef}
          defaultSize="50%"
          minSize={LAYOUT_COLLAPSED_PX}
          collapsible
          collapsedSize={LAYOUT_COLLAPSED_PX}
          onResize={(size) => setRightCollapsed(isCollapsed(size))}
          className={`${styles.panel} ${styles.panelRight}`}
          style={{ overflow: "hidden" }}
        >
          {rightCollapsed && (
            <CollapsedBar label={label} side="right" onExpand={() => expand(rightRef)} />
          )}
          <section className={styles.panelInner} hidden={rightCollapsed} aria-label={label}>
            <header className={styles.panelHeader}>
              <div className={styles.panelControls}>
                <button
                  ref={setMenuAnchor}
                  type="button"
                  className={styles.worldBtn}
                  aria-haspopup="listbox"
                  aria-expanded={menuOpen}
                  aria-label={`${label}. Choose a feed`}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <WorldGlyph value={world} size={15} />
                  <span className={styles.worldName}>{label}</span>
                  <ChevronDown size={13} aria-hidden="true" className={menuOpen ? styles.chevronOpen : styles.chevron} />
                </button>
                <span className={`${styles.zoneBadge} ${styles.zoneBadgeWorld}`}>All campuses</span>
              </div>
              <div className={styles.panelTools}>
                {/* Hot · New on the right, beside ⤢ (owner, 7 Nov). */}
                <SortSwitch sort={sort} onChange={setSort} />
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => toggleMax(leftRef)}
                  aria-label={leftCollapsed ? "Restore both panels" : `Open ${label} full width`}
                  title={leftCollapsed ? "Restore" : "Full width"}
                >
                  {leftCollapsed ? <Minimize2 size={13} aria-hidden="true" /> : <Maximize2 size={13} aria-hidden="true" />}
                </button>
              </div>
            </header>
            <CommunityFeed
              key={`${worldFeed.kind}:${worldFeed.country ?? ""}:${sort}`}
              {...worldFeed}
              sort={sort}
              inPanel
              side="right"
              onComposerActive={onRightActive}
              selected={side === "right"}
              focusSignal={focusSignals.right}
              onCanPostChange={setRightCanPost}
              {...shared}
            />
          </section>
        </Panel>
      </Group>

      {menuOpen && (
        <CountryMenu
          anchorEl={menuAnchor}
          value={world}
          countries={countries}
          onChange={setWorld}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

/* ── < 1024 px: the switcher ───────────────────────────────────────────── */

function NarrowLayout({
  campusFeed,
  worldFeed,
  world,
  setWorld,
  sort,
  setSort,
  segment,
  setSegment,
  countries,
  shared,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const label = worldLabel(world, countries);
  const onWorld = segment === "world";

  return (
    <div className={styles.narrow} data-feed={onWorld ? "world" : "campus"}>
      {/* Transparent and floating: the posts scroll underneath it. */}
      <div className={styles.switcher}>
        <div className={styles.segments} role="group" aria-label="Community feeds">
          <button
            type="button"
            aria-pressed={!onWorld}
            aria-label="My campus"
            title="My campus"
            className={`${styles.segment} ${styles.segmentIcon} ${!onWorld ? styles.segmentActive : ""}`}
            onClick={() => setSegment("campus")}
          >
            <CampusIcon size={17} />
          </button>
          {/* The whole purple pill anchors the dropdown, so a press on either
              button counts as inside it and toggles it, instead of closing it
              and opening it again. */}
          <div
            ref={setMenuAnchor}
            className={`${styles.worldSegment} ${onWorld ? styles.worldSegmentActive : ""}`}
          >
            {/* Off this feed it selects the feed; on it, it opens the dropdown,
                like the chevron (owner, 8 Nov: the chevron alone was too small
                a target on a phone). */}
            <button
              type="button"
              aria-pressed={onWorld}
              aria-haspopup={onWorld ? "listbox" : undefined}
              aria-expanded={onWorld ? menuOpen : undefined}
              className={styles.segment}
              onClick={() => (onWorld ? setMenuOpen((o) => !o) : setSegment("world"))}
            >
              <WorldGlyph value={world} size={15} />
              <span className={styles.segmentName}>{label}</span>
            </button>
            {/* Its own button, inside the purple, and only once you're on this feed. */}
            <button
              type="button"
              inert={!onWorld}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-label="Choose a feed"
              title="Choose a feed"
              className={styles.segmentChevron}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <ChevronDown size={14} aria-hidden="true" className={menuOpen ? styles.chevronOpen : styles.chevron} />
            </button>
          </div>
        </div>
        {/* The site navbar is hidden here on a phone too (App.jsx); the menu is
            this pill, always at the right end, with Hot · New just before it
            on the country / Global side (owner, 8 Nov). */}
        <div className={styles.switcherEnd}>
          {onWorld && (
            <div className={styles.switcherSort}>
              <SortSwitch sort={sort} onChange={setSort} />
            </div>
          )}
          <BrandMenu inBar />
        </div>
      </div>

      {onWorld ? (
        <CommunityFeed
          key={`${worldFeed.kind}:${worldFeed.country ?? ""}:${sort}`}
          {...worldFeed}
          sort={sort}
          {...shared}
        />
      ) : (
        <CommunityFeed key="campus" {...campusFeed} {...shared} />
      )}

      {menuOpen && (
        <CountryMenu
          anchorEl={menuAnchor}
          value={world}
          countries={countries}
          onChange={(code) => {
            setWorld(code);
            setSegment("world");
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
