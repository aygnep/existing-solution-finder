# Product Specification

## Promise

Fixseek helps developers and coding agents discover existing technical
solutions before building from scratch. It turns a problem description or error
log into traceable repositories, packages, issues, documentation, and
workarounds.

The product optimizes for an auditable decision, not an unsupported answer:
recommendations show evidence, fit signals, risks, and safe validation steps.

## Interfaces and Inputs

- Developers use the CLI or the local Web Solution Guide.
- Coding agents consume exported skill drafts and must not treat a result as
  permission to execute it.
- Inputs are problem text, error logs, optional stack and constraints, selected
  providers, and mock or real mode.

## Result

DiscoveryResult contains a parsed problem, visible search plan, per-provider
state, grouped candidates, source URLs and excerpts, score details, warnings,
and validation guidance. The Web UI can export selected candidates as a
Markdown report or agent-skill draft.

## Safety Boundaries

- Never install, clone, execute, or modify a candidate automatically.
- Never expose provider credentials to the browser, output, logs, or exports.
- Never hide archival, licensing, suspicious-install, or secret-transmission
  risks.
- Provider failure is visible partial state, not a fabricated answer.

## Scope

Included: local CLI, local no-account Web Solution Guide, GitHub, npm, optional
web providers, deterministic ranking, explicit opt-in Jev reranking with
rule-order fallback, and ephemeral sessions.

Deferred: persistence, accounts, teams, private sources, authentication,
automatic remediation, and generative-model control over search or safety.
