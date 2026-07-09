# Fixseek Web Solution Guide Design

**Date:** 2026-07-10
**Status:** User-approved design; pending written-spec review

## 1. Product Direction

Fixseek will evolve from a CLI that ranks existing technical solutions into a
web-based **Solution Guide**. It serves individual developers and coding
agents through the same discovery engine: understand a problem, find and
compare evidence, decide how to validate a candidate, then export a reusable
artifact.

The first web release is developer-oriented. Its source model is intentionally
extensible to other public domains later, but its ranking, risk checks, and
validation language are optimized for software tools, repositories, packages,
issues, official documentation, and public technical discussions.

The product must not become a generic answer chat. Its distinguishing promise
is an auditable, user-controlled path from a technical problem to a reusable
solution proposal.

## 2. External Patterns and Differentiation

The design borrows specific interaction patterns rather than cloning another
product:

- Exa's search API combines web search with extracted page contents and
  highlights. Fixseek should attach each conclusion to inspectable evidence.
  Source: <https://exa.ai/docs/reference/search>
- GitHub Copilot's cloud agent follows a research, plan, implementation, and
  review loop. Fixseek should expose the research and planning stages before
  proposing a solution, but must stop before executing changes. Source:
  <https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent>
- Citation-focused answer engines make sources visible, but they generally do
  not compare package/repository suitability, maintenance, license, or install
  risk for a developer decision. These are Fixseek's primary differentiators.

## 3. First-Release Scope

### Included

- A no-account web experience for one ephemeral solution-discovery session.
- Guided intake for error logs, natural-language goals, technology stack, and
  constraints.
- An editable, visible search plan before search execution.
- Parallel public-source search through the existing GitHub, npm, and web
  provider model.
- Candidate grouping, evidence comparison, explainable scores, and safety
  warnings.
- Human-controlled validation checklists; Fixseek never executes a candidate's
  commands.
- Export of a Markdown solution report and a compact, evidence-preserving
  agent-skill draft.

### Explicitly Excluded

- Login, accounts, saved history, team workspaces, comments, permissions, or
  private source connections.
- A database or a multi-tenant long-running backend.
- Automatic installation, cloning, shell execution, code modification, or
  claim that a candidate is safe without evidence.
- LLM control of raw search, score calculation, or safety classification.

## 4. User Journey

```text
Input problem
  -> clarify context and constraints
  -> review/edit search plan
  -> gather and normalize evidence
  -> compare solution candidates
  -> review validation steps and risks
  -> export Markdown report or agent skill draft
```

The web page represents a task, not a chat transcript. A user may edit parsed
keywords, providers, and constraints before a search. Each candidate is shown
as a solution card containing its source evidence, match reason, compatibility
assumptions, safety and maintenance signals, and suggested validation steps.

Facts backed by a source must be visibly distinct from Fixseek's inference or
recommendation. A user must explicitly select the candidates included in an
export.

## 5. Architecture

```text
Browser Web UI
  -> session-only client state
  -> thin local/single-process search gateway
  -> shared Fixseek discovery core
       parse -> plan -> search -> normalize -> group -> score -> rank
  -> structured JSON result contract
  -> Web comparison view and client-side exporters
```

### Component Responsibilities

| Component | Responsibility | Must not do |
| --- | --- | --- |
| Web UI | Intake, plan editing, progress, evidence comparison, user selection, export | Store provider secrets or redefine safety rules |
| Search gateway | Adapt browser requests to the core, keep provider credentials server-side, report provider status | Add accounts, persistence, or separate ranking logic |
| Fixseek discovery core | Parse, plan queries, call providers, normalize evidence, group candidates, score/rank, classify risks | Render CLI-only text as the canonical result |
| Exporters | Generate selected-candidate Markdown and agent-skill drafts | Hide source URLs, risks, or unverified status |

The gateway is a deliberately small bridge, not the deferred product backend.
The eventual account/team backend will consume the same structured contract,
so the Web UI does not need to be rewritten for persistence later.

## 6. Discovery-Core Enhancements

The current core has parsing, query generation, providers, scoring, ranking,
and CLI summaries. The Web release requires these targeted improvements:

1. **Structured result contract.** Return parsed problem data, an editable
   search plan, per-provider status, grouped candidates, evidence, scoring
   breakdowns, risks, and validation guidance as typed JSON. The CLI becomes a
   renderer of this contract rather than its owner.
2. **Evidence provenance.** Preserve URL, source kind, quoted/extracted
   fragment, retrieval time, and evidence strength for each candidate claim.
3. **Candidate grouping.** Link related repository, package, issue, document,
   and workaround records into one solution candidate without discarding the
   original records.
4. **Explainable decisions.** Preserve the existing score breakdown and show
   both positive signals and penalties, with explicit compatibility
   assumptions.
5. **Validation guidance.** Produce read-only verification steps, expected
   observations, and risk reminders. Guidance is never an automatic action.
6. **Provider resilience.** Treat a failed, rate-limited, unavailable, or
   unconfigured provider as partial task state, not a whole-task failure.

An optional LLM layer may later explain the plan or summarize sourced evidence.
It is prohibited from replacing provider search, deterministic scoring, or
safety classification.

## 7. Data and Error Handling

The search plan names the enabled providers and the intent of each query.
Providers operate independently. The UI displays completion, empty-result,
skipped, or failed status per provider. Results from successful providers stay
available when another provider fails.

Each candidate must retain:

- original source URLs and source types;
- evidence excerpts and retrieval time;
- score and score breakdown;
- risk warnings and their trigger;
- applicability assumptions;
- validation steps;
- user inclusion/exclusion state for export.

If evidence is sparse, the candidate is labelled low-evidence rather than
presented as verified. Archived repositories, absent licenses, suspicious
install scripts, and other existing warnings remain visible in the comparison
view and all exports. Provider credentials never reach the browser, and input
is not persisted by default.

## 8. Verification and Acceptance Criteria

### Automated Verification

- Unit tests cover the typed result contract, provenance, candidate grouping,
  explainable scores, and each provider's degraded state.
- Existing CLI tests continue to pass; CLI and gateway produce equivalent
  candidate, score, and warning data for the same fixtures.
- Web end-to-end tests cover intake, plan editing, partial provider failure,
  candidate comparison, selection, and both export formats.
- Tests assert that provider tokens are absent from browser-visible payloads,
  logs, and exports.

### Product Acceptance

- A developer can turn an error log or problem statement into an editable
  search plan and inspect the progress of each source.
- Every recommendation shown in the UI provides at least one traceable source
  or is explicitly labelled as a low-evidence inference.
- Users can compare candidates by fit, evidence, maintenance, license, and
  risk without opening every source first.
- A report and an agent-skill draft export selected candidates with their
  evidence and safety status intact.
- A provider failure does not erase successful results from other providers.

## 9. Deferred Follow-On Work

Once the discovery core and no-account Web experience are stable, the same
contract can support persistent history, user accounts, shared verified
solution libraries, private repositories/knowledge bases, permissions, and
team review workflows. Those capabilities are intentionally outside this
release.
