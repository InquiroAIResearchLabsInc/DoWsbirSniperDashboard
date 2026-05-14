# inquiro-standards

The institutional brain for Inquiro AI Research Labs. Every Claude Code and Cursor session reads this folder before touching any project. Lessons write back here. Architecture principles get promoted here. The folder lives on the Desktop so it is reachable from any project via a consistent relative path (`../../Desktop/inquiro-standards/` or `~/Desktop/inquiro-standards/`).

---

## Files

| File | What it is | Rule |
|---|---|---|
| `CLAUDEME.md` | Master execution standard — laws, gates, receipts, security, session protocol | Read every session start |
| `RNA.md` | Receipts-native architecture — definition, principles, domain SLOs, MCP protocol | Read before any ledger work |
| `META_LOOP.md` | 8-phase learning cycle — topology classification, constants, cascade rules | Read before classifying any module |
| `MONTE_CARLO.md` | 8 mandatory simulation scenarios — all must pass before T+48h gate | Read before any gate run |
| `lessons.md` | Global correction ledger — append after every correction, every session | Append-only, no edits |
| `META_LESSONS.md` | Promoted architecture principles — human-confirmed from lessons.md | Read at session start |
| `todo.md` | Meta task patterns — how tasks should be structured, not a task list | Read at session start |

---

## How Claude Code uses it

**Session start:** read CLAUDEME.md → lessons.md → META_LESSONS.md → todo.md

**During session:** on any correction → append to lessons.md before continuing

**Before T+48h gate:** confirm Monte Carlo all 8 pass, confirm no `[→]` tasks open

**Session end:** commit with format from CLAUDEME §15

---

**Version:** 5.0 | **Updated:** 2026-04-21 | **Location:** `~/Desktop/inquiro-standards/`
