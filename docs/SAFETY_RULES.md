# Safety Rules

## Purpose

This tool recommends tools and projects that users may install and run. That creates a responsibility: **we must not lead users into unsafe situations**. These rules are non-negotiable and must be enforced in both code and output.

---

## What the System Must NOT Do

| Prohibition | Rationale |
|---|---|
| Execute downloaded code automatically | Code from unknown sources can be malicious |
| Recommend pasting secrets into unknown websites | Credential theft |
| Hide risks from the user | Informed consent requires full information |
| Mark a project as trusted solely because it has many stars | Stars can be bought or gamed |
| Suggest disabling security protections (firewalls, TLS, sandboxes) without clear, documented justification | Defense-in-depth must be preserved |
| Score a candidate higher because it's well-known (brand bias) | Popularity ≠ safety or fit |
| Silently skip safety checks due to rate limits | Fail loudly, not silently |

---

## What the System MUST Do

### Warnings

Always emit a visible warning when:

- **New project:** created < 6 months ago AND stars < 100
- **Low stars:** < 50 stars (unless it's an official org project)
- **No license:** cannot legally use in many contexts
- **Archived repository:** project is abandoned
- **Suspicious install script:** any install step that pipes curl/wget to bash/sh without a checksum
- **Requires secrets transmission:** README instructs user to send API keys, tokens, or passwords to an unrecognized third party

Warning format (in output):
```
⚠️  WARNING: [CATEGORY] — [Explanation]
```

### Provenance Check

For each candidate, the system should surface:
- Repository owner type (individual vs. organization)
- License (SPDX identifier)
- Last commit date
- Open issue count
- Whether the project links to an official docs site or is referenced in official docs

### Trust Levels

| Level | Label | Criteria |
|---|---|---|
| HIGH | ✅ Trusted | Official project of a recognized org, active, licensed, documented |
| MEDIUM | 🔶 Unverified | Community project, active, has license and README |
| LOW | ⚠️ Caution | New, few stars, no license, or inactive |
| BLOCKED | 🚫 Risky | Archived, suspicious install, secrets exposure |

The trust level appears next to each candidate in output. It is **informational only** — the system does not refuse to show BLOCKED candidates, but must always display the reason.

---

## Safety vs. Utility Trade-off

This tool is designed to **inform, not decide**. The user always makes the final call. Our job is to surface all relevant safety information clearly so the user can make an informed choice.

**Do not:**
- Filter out candidates below a safety threshold (user may know something we don't)
- Rank safety higher than relevance (a risky but highly relevant tool should still appear)

**Do:**
- Display safety warnings prominently, before the install instructions
- Separate "likely useful" from "verified safe" in output

---

## Example Output Pattern

```
[3] openai-proxy-strip (github.com/example/openai-proxy-strip)
Score: 61 | 🔶 Unverified

Why: Strips extra fields from OpenAI-compatible API responses, including reasoning_content.

⚠️  WARNING: LOW_STARS — Only 12 GitHub stars. Not widely tested.
⚠️  WARNING: NEW_PROJECT — Created 2 months ago.

Install: npm install openai-proxy-strip
Next step: See README section "Custom field stripping"
```
