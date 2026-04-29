# Scoring Rules

## Overview

Each candidate receives a composite score from **0 to 100** (before penalties). The score reflects how well the candidate matches the problem and how trustworthy it appears.

**Important:** These rules are the source of truth. Do not change scoring weights without updating this document.

---

## Score Components (max 100)

| Component | Max Points | Description |
|---|---|---|
| Exact error match | 25 | Candidate title, README, or description contains exact error token(s) |
| Stack match | 20 | Candidate explicitly supports the tech stack in the problem |
| README evidence | 15 | README contains usage example directly relevant to the problem |
| Recency | 10 | Last commit within 12 months |
| Installation clarity | 10 | Clear, copy-pasteable install instructions exist |
| Maintenance activity | 10 | Open issues are being responded to; PR merge rate > 0 |
| Example config | 10 | Provides working example config relevant to the use case |

### Component Calculation Details

**Exact error match (0–25)**
- 25: exact error string found in README or title
- 15: error string found in issues or wiki
- 5: related error class found (e.g., "field stripping" for "reasoning_content")
- 0: no mention

**Stack match (0–20)**
- 20: all tools in problem explicitly listed as supported
- 12: majority of tools mentioned
- 5: one relevant tool mentioned
- 0: no stack overlap

**README evidence (0–15)**
- 15: working example in README matches the problem use case
- 8: general usage section exists but not specific to the problem
- 0: no README or README is empty

**Recency (0–10)**
- 10: last commit < 3 months ago
- 7: last commit 3–12 months ago
- 3: last commit 1–2 years ago
- 0: last commit > 2 years ago

**Installation clarity (0–10)**
- 10: `npm install`, `pip install`, `go install`, or `brew install` command present
- 5: build-from-source instructions exist
- 0: no install instructions

**Maintenance activity (0–10)**
- 10: issues responded to within 7 days on average, PRs merged in last 6 months
- 5: some activity, responses within 30 days
- 0: no activity in 6+ months

**Example config (0–10)**
- 10: example config file directly usable for the problem
- 5: partial example exists
- 0: no config examples

---

## Penalties (subtracted from composite score)

| Condition | Penalty |
|---|---|
| No README | −10 |
| No license file | −5 |
| Archived repository | −30 |
| Suspicious install script (curl pipe bash without checksum) | −30 |
| Requires sending secrets to unknown third-party server | −30 |
| Fork with no upstream credit and no meaningful changes | −10 |
| Last commit > 3 years ago | −15 |

**Penalty stacking:** Multiple penalties are additive. A score can go negative; negative scores are clamped to 0 for display but the raw negative value is preserved in the `Score` object for debugging.

---

## Score Interpretation

| Score | Label | Recommended Action |
|---|---|---|
| 70–100 | 🟢 Strong Match | Review and likely use |
| 40–69 | 🟡 Possible Match | Investigate further |
| 10–39 | 🟠 Weak Match | Low priority, check only if others fail |
| 0–9 | 🔴 Poor Match | Skip unless no alternatives |

---

## Tie-Breaking

When two candidates have the same composite score:
1. Higher `exactErrorMatch` wins.
2. Then higher `stackMatch`.
3. Then more recent last commit.
4. Then alphabetical by repository name (deterministic).
