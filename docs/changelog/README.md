# docs/changelog/ — one file per entry

This folder is how Vishwajeet and Neeraj tell each other what changed. Every entry is its own
small Markdown file. It replaces the single `docs/CHANGELOG.md`, which is **frozen as of
2026-09-27** and kept only for its history and the links that point into it.

## Why it exists

The old file had two problems:

1. **Merge conflicts.** Both of us added entries at the top of the same file, so both branches
   edited the same lines, and the second pull request to merge always conflicted.
2. **Token cost.** Every Claude Code session read the whole file at startup — about 65,000
   tokens of history before looking at a single line of code.

Here, adding an entry **creates a new file and never edits an existing one**. Two new files
with different names have nothing to merge, so git cannot conflict on them. And a session
reads a one-line-per-entry list of the newest eight, then opens only the ones it needs.

## Filename format

```
YYYY-MM-DD-HHMMSS-<author>-<slug>.md
2026-10-01-184400-neeraj-changelog-one-file-per-entry.md
```

The date comes first, so `ls docs/changelog/` lists entries in time order across everyone. The
`HHMMSS` part means two entries by one person on one day still get different names. Do not
create these by hand — use the script, which fills in the name and the template.

## The commands

Run from anywhere in the repo (the script finds this folder from its own location).

**Add an entry** — prints the path of the new file; open it and fill it in.

```
node scripts/changelog.mjs new <author> "<title>" [--phase P] [--block B] [--for who]

node scripts/changelog.mjs new vishwajeet "Search: demo accounts isolated both ways" --phase 6A --block V-A --for neeraj
```

`--for` names the person the entry is meant for. Use it whenever the other person has to do
or know something.

**See what changed recently** — newest first, one line each. This is what every session runs
at the start instead of reading the old file.

```
node scripts/changelog.mjs recent        # newest 8
node scripts/changelog.mjs recent 20
```

```
2026-10-01 18:44  neeraj      Changelog: one file per entry  [phase 6A · block N-A · for vishwajeet]  — 2026-10-01-184400-neeraj-changelog-one-file-per-entry.md
```

**See everything addressed to you**

```
node scripts/changelog.mjs for neeraj
node scripts/changelog.mjs for vishwajeet
```

## Releasing a phase

**Why.** Small files during the work, one file per release: this is what tools like
changesets and towncrier do. Git copes fine with hundreds of small files. People reading this
folder don't. After a few phases, `ls docs/changelog/` would be a wall of names, most of them
about work that finished long ago.

**When.** Only at a phase's **SIGN-OFF**, after both of us have merged everything for that
phase. Releasing earlier would leave a late entry for that phase with nowhere to go.

**How.** Look first, then do it, then commit:

```
node scripts/changelog.mjs release 6B --dry-run   # lists what it would write and delete; changes nothing
node scripts/changelog.mjs release 6B
git add -A docs/changelog
git commit -m "docs(changelog): release phase 6B"
```

**What happens.** Every entry tagged with that phase is joined into one file,
`docs/changelog/releases/phase-<P>.md`:

- a table of all the entries on top;
- then every entry in full, oldest first;
- each entry keeps its original file name inside the release file, so an old reference such as
  `2026-10-04-184315` still finds it. Search the release file for it.

The small files are deleted. Git history still has every one of them. Entries with a different
phase, or with no phase, are not touched.

**A phase is released once.** If `releases/phase-<P>.md` already exists, `release <P>` refuses
to run. So an entry that comes in after its phase was released can't join it: tag it with the
next phase instead.

`recent` names the release files on its last line, so a new session still knows where the
older entries went.

## The template — every entry is the same

The script writes YAML frontmatter (`date`, `author`, `phase`, `block`, `for`, `title`), a
`# <title>` heading, and these six sections:

```markdown
## Migrations applied
## New endpoints
## Changed endpoints (BREAKING)
## New fields on existing responses
## Test data
## What NOT to do yet
```

Keep all six, even if empty — write "None." rather than deleting a heading, so the other
person can see you thought about it. The last one, **What NOT to do yet**, is the one people
skip and the one that saves the most time. Add your own sections (screenshots, a judgement
call, a test matrix) below the six if you need them.

**Migration requests** are entries too: `new neeraj "Migration request: …" --for vishwajeet`,
saying what you need, why, and what it is blocking. Vishwajeet answers with his own entry
naming the migration file.

## The rule

**Anyone adds files. Nobody edits another person's entry, except to fix a broken link.**

To correct or follow up on something, add a new entry that says so. Editing your *own* entry
before it is merged is fine. And never add an index or a "latest" file that every entry
updates — that would bring the conflicts straight back.
