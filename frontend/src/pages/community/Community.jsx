// frontend/src/pages/community/Community.jsx
//
// The Community page — docs/design/COMMUNITY_SPEC.md §1.
//
//   ≥ 1024 px  two panels (react-resizable-panels): My campus on the left,
//              a country or Global on the right. Drag, double-click for
//              50 / 50, keyboard on the divider, collapse to a 44 px bar,
//              ⤢ for full width. The layout is remembered.
//   < 1024 px  one feed at a time behind a sticky segmented switcher, like
//              the app.
//
// Only one layout is mounted (useMediaQuery), so the feeds load once. Both
// layouts offer the same feeds and the same actions (frontend/CLAUDE.md §18).
//
// ⚠ Part 1: everything here runs on ./sampleData.js. Part 2 replaces it with
// the posts API and deletes that file.

import React, { useCallback, useMemo, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import CommunityFeed from "./CommunityFeed";
import CountryMenu, { GLOBAL, worldLabel } from "./CountryMenu";
import useMediaQuery from "../../hooks/useMediaQuery";
import { useHistoryEntryState } from "../../hooks/useScrollRestoration";
import {
  LAYOUT_BREAKPOINT_PX,
  LAYOUT_COLLAPSED_PX,
  LAYOUT_MIN_PANEL_PX,
} from "../../utils/community";
import { SAMPLE_COUNTRIES, SAMPLE_VIEWER, sampleReact } from "./sampleData";
import styles from "./Community.module.css";

const LAYOUT_KEY = "yahora.community.layout";
const LEFT = "campus";
const RIGHT = "world";

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

/** Hot · New (spec §1.1), only on the country / Global side. */
function SortSwitch({ sort, onChange }) {
  return (
    <div className={styles.sortSwitch} role="group" aria-label="Sort posts">
      {[
        ["hot", "Hot"],
        ["new", "New"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={sort === value}
          className={`${styles.sortBtn} ${sort === value ? styles.sortBtnActive : ""}`}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A panel collapsed to its 44 px bar: the name written vertically and an
    expand button (spec §1.1). */
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
        <Icon size={18} aria-hidden="true" />
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

  const worldName = world === GLOBAL ? "Global" : countries.find((c) => c.code === world)?.name ?? world;

  // Spec §2.1 and §9: the words for each feed.
  const campusFeed = {
    kind: "campus",
    composerText: "What's happening on campus?",
    emptyText: `No posts from ${campusName} yet. Be the first to say hello 👋`,
  };
  const worldFeed =
    world === GLOBAL
      ? {
          kind: "global",
          composerText: "Share with students everywhere",
          emptyText: "Nothing here yet. Start the conversation 🌍",
        }
      : {
          kind: "country",
          country: world,
          composerText: `Share with students in ${worldName}`,
          emptyText:
            world === myCountry
              ? `No posts from students in ${worldName} yet. Start the conversation.`
              : `No posts from students in ${worldName} yet.`,
          viewOnlyName: worldName,
        };

  const shared = { countries, patches, onReact };

  return wide ? (
    <WideLayout
      campusName={campusName}
      campusFeed={campusFeed}
      worldFeed={worldFeed}
      world={world}
      setWorld={setWorld}
      sort={sort}
      setSort={setSort}
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
      shared={shared}
    />
  );
}

/* ── ≥ 1024 px: two panels ─────────────────────────────────────────────── */

function WideLayout({ campusName, campusFeed, worldFeed, world, setWorld, sort, setSort, shared }) {
  const { countries } = shared;
  const leftRef = usePanelRef();
  const rightRef = usePanelRef();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftScroll, setLeftScroll] = useState(null);
  const [rightScroll, setRightScroll] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const defaultLayout = useMemo(readLayout, []);

  const isCollapsed = (size) => size.inPixels <= LAYOUT_COLLAPSED_PX + 2;

  // ⤢ opens this panel full width by collapsing the other; pressed again
  // (the other one is collapsed) it restores both.
  const toggleMax = (otherRef) => {
    const other = otherRef.current;
    if (!other) return;
    if (other.isCollapsed()) other.expand();
    else other.collapse();
  };

  const label = worldLabel(world, countries);

  return (
    <div className={styles.wide}>
      <Group
        orientation="horizontal"
        className={styles.group}
        defaultLayout={defaultLayout}
        onLayoutChanged={(layout, meta) => saveLayout(meta?.requestedLayout ?? layout)}
      >
        <Panel
          id={LEFT}
          panelRef={leftRef}
          defaultSize="50%"
          minSize={LAYOUT_MIN_PANEL_PX}
          collapsible
          collapsedSize={LAYOUT_COLLAPSED_PX}
          onResize={(size) => setLeftCollapsed(isCollapsed(size))}
          className={styles.panel}
        >
          {leftCollapsed && (
            <CollapsedBar label="My campus" side="left" onExpand={() => leftRef.current?.expand()} />
          )}
          {/* Kept mounted while collapsed, so expanding again finds the feed
              where it was instead of reloading it. */}
          <section className={styles.panelInner} hidden={leftCollapsed} aria-label="My campus">
            <header className={styles.panelHeader}>
              <h2 className={styles.campusTitle}>
                <span aria-hidden="true">🏫</span> {campusName}
              </h2>
              <div className={styles.panelTools}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => leftRef.current?.collapse()}
                  aria-label="Collapse My campus"
                  title="Collapse"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => toggleMax(rightRef)}
                  aria-label={rightCollapsed ? "Restore both panels" : "Open My campus full width"}
                  title={rightCollapsed ? "Restore" : "Full width"}
                >
                  {rightCollapsed ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
                </button>
              </div>
            </header>
            <div ref={setLeftScroll} className={styles.panelScroll}>
              <CommunityFeed key="campus" {...campusFeed} scrollRoot={leftScroll} {...shared} />
            </div>
          </section>
        </Panel>

        <Separator className={styles.handle} />

        <Panel
          id={RIGHT}
          panelRef={rightRef}
          defaultSize="50%"
          minSize={LAYOUT_MIN_PANEL_PX}
          collapsible
          collapsedSize={LAYOUT_COLLAPSED_PX}
          onResize={(size) => setRightCollapsed(isCollapsed(size))}
          className={styles.panel}
        >
          {rightCollapsed && (
            <CollapsedBar label={label} side="right" onExpand={() => rightRef.current?.expand()} />
          )}
          <section className={styles.panelInner} hidden={rightCollapsed} aria-label={label}>
            <header className={styles.panelHeader}>
              <div className={styles.panelControls}>
                <button
                  ref={setMenuAnchor}
                  type="button"
                  className={styles.countryBtn}
                  aria-haspopup="listbox"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <span>{label}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <SortSwitch sort={sort} onChange={setSort} />
              </div>
              <div className={styles.panelTools}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => toggleMax(leftRef)}
                  aria-label={leftCollapsed ? "Restore both panels" : `Open ${label} full width`}
                  title={leftCollapsed ? "Restore" : "Full width"}
                >
                  {leftCollapsed ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => rightRef.current?.collapse()}
                  aria-label={`Collapse ${label}`}
                  title="Collapse"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </header>
            <div ref={setRightScroll} className={styles.panelScroll}>
              <CommunityFeed
                key={`${worldFeed.kind}:${worldFeed.country ?? ""}:${sort}`}
                {...worldFeed}
                sort={sort}
                scrollRoot={rightScroll}
                {...shared}
              />
            </div>
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
  shared,
}) {
  const { countries } = shared;
  const [worldSeg, setWorldSeg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const label = worldLabel(world, countries);
  const onWorld = segment === "world";

  return (
    <div className={styles.narrow}>
      <div className={styles.switcher}>
        {/* The feed's own column, so the switcher lines up with the posts. */}
        <div className={styles.switcherInner}>
          <div className={styles.segments} role="tablist" aria-label="Community feeds">
            <button
              type="button"
              role="tab"
              aria-selected={!onWorld}
              className={`${styles.segment} ${!onWorld ? styles.segmentActive : ""}`}
              onClick={() => setSegment("campus")}
            >
              Campus
            </button>
            <button
              ref={setWorldSeg}
              type="button"
              role="tab"
              aria-selected={onWorld}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              className={`${styles.segment} ${onWorld ? styles.segmentActive : ""}`}
              // Spec §1.2: tapping it again, once selected, opens the dropdown.
              onClick={() => (onWorld ? setMenuOpen((o) => !o) : setSegment("world"))}
            >
              <span>{label}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          {onWorld && <SortSwitch sort={sort} onChange={setSort} />}
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
          anchorEl={worldSeg}
          value={world}
          countries={countries}
          onChange={setWorld}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
