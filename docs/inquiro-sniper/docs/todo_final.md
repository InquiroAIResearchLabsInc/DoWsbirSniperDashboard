# todo.md — Meta Task Pattern Ledger

**NOT a session task list.** Session tasks belong in each repo's own `todo.md`.
This file captures patterns about how tasks should be structured across all builds.
Location: `~/Desktop/inquiro-standards/todo.md`
Append-only. Human-curated from per-repo session observations.

---

## FORMAT (strict)

```
## [Pattern Name]
**Captured:** YYYY-MM-DD
**Worked:** [what decomposition/sequencing/plan structure succeeded]
**Failed:** [the anti-pattern it replaces]
**When:** [context that triggers this pattern]
```

---

## PATTERNS

## Plan Before Execute

**Captured:** 2026-04-21
**Worked:** Write all steps to repo-level `todo.md` with verification command per step before executing any step. No step closes to `[x]` without a passing command.
**Failed:** Sequential execution without a written plan; losing track of which subtask needed which verification; marking complete by judgment not proof.
**When:** Any task with 3 or more discrete steps. Non-negotiable.

## Four Task States

**Captured:** 2026-04-21
**Worked:** `[ ]` pending · `[→]` in progress · `[x]` complete (verified) · `[!]` blocked (with documented blocker). NEVER commit with `[→]` open.
**Failed:** Binary done/not-done; blockers disguised as in-progress; implicit state that requires reading the code to understand.
**When:** Every repo-level `todo.md`. Universal.

## Subagent for Heavy Research

**Captured:** 2026-04-21
**Worked:** Delegate file-heavy research to subagent, receive summary + receipt hash. Main context stays clean for orchestration.
**Failed:** Reading 20+ files in main context; context bloat degrading output quality in later steps.
**When:** Any task requiring reading > 5 files or parallel research across independent threads.

## Fresh Context for Review

**Captured:** 2026-04-21
**Worked:** Writer/Reviewer pattern — one session writes, a separate fresh session reviews. Fresh context is not biased toward code it just wrote.
**Failed:** Same session reviewing its own code immediately after writing; pattern-matching to its own decisions rather than the actual code.
**When:** Any PR review, security audit, or code quality pass.

---

*New patterns append below after observation and human confirmation.*
