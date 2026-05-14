# lessons.md — Global Correction Ledger

**APPEND-ONLY. No edits to existing entries. No deletions.**
Every Claude Code / Cursor session MUST append here before continuing after any correction.
Location: `~/Desktop/inquiro-standards/lessons.md`

---

## FORMAT (strict)

```
## YYYY-MM-DD | repo: [name] | receipt: [dual_hash of rule text]
**Broke:** [what — one sentence]
**Why:** [root cause — one sentence]
**RULE:** [MUST or NEVER — imperative, ≤15 words]
```

Promotion criterion: same RULE pattern from 2+ repos → human promotes to `META_LESSONS.md`.

---

## ENTRIES

## 2026-04-21 | repo: inquiro-standards | receipt: seed

**Broke:** Session corrections disappeared between Claude Code sessions across 50+ repos.
**Why:** No persistent ledger existed — corrections lived in transient chat history.
**RULE:** MUST append every correction to this file before resuming the session.

---

*New entries append below this line.*
