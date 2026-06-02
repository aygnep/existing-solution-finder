# Agent-First Fixseek Skill And CLI Simplification Design

## Purpose

This spec defines the next product slice after the M2.5/M3 planning work:
package Fixseek as a global agent skill and simplify the CLI surface so agents
can reliably use it before building, debugging, or integrating new tools.

The primary audience is Codex/Claude-style coding agents. Human CLI users remain
supported, but this slice optimizes the workflow for agent handoff and repeated
agent use.

## Goals

- Create a global `fixseek` skill that tells agents when and how to search for
  existing solutions before writing code.
- Keep the skill concise, with the CLI doing the deterministic search work.
- Reduce CLI help noise by making the primary commands obvious.
- Preserve backward compatibility for existing CLI commands and flags.
- Keep safety boundaries explicit: do not install, clone, or execute candidate
  projects automatically.

## Non-Goals

- Do not add a frontend.
- Do not add an LLM summary provider inside the CLI.
- Do not remove existing CLI compatibility paths in this slice.
- Do not publish to npm automatically.
- Do not make the skill depend on private local paths that would break on other
  machines.

## Proposed User Experience

### Agent Skill Flow

When the agent is asked to fix a bug, debug an error, find a package, evaluate a
tooling issue, or build a workaround, the skill should:

1. Extract the problem statement, error tokens, and stack hints from the user
   request.
2. Prefer real search when credentials are configured:

   ```bash
   fixseek --real "problem text"
   ```

3. Use stdin for long logs:

   ```bash
   cat error.log | fixseek --stdin --real
   ```

4. If real search cannot run because `GITHUB_TOKEN` is missing, tell the user
   that real search is unavailable and either run mock mode only as a local smoke
   check or ask whether to continue without external evidence.
5. Summarize the top candidates with match reason, risk warnings, and suggested
   next action.
6. Never execute installation commands or clone repositories from results
   without explicit user approval.

### CLI Surface

The primary visible CLI should emphasize:

```bash
fixseek "problem"
fixseek --stdin
fixseek --real "problem"
fixseek --lang zh "problem"
fixseek --max-results 5 "problem"
```

Keep these as supported but de-emphasized compatibility or advanced controls:

- `fixseek solve "problem"`
- `--mock`
- `--provider github|web|npm`
- `--log-level warn|debug|info|error`
- `--stack "Node.js,Docker"`

The compatibility command and advanced flags should keep working because they
are already documented and tested. The simplification is primarily a help text,
README, and skill guidance change unless tests reveal an ergonomics issue that
requires small CLI behavior changes.

## Architecture

### Skill Package

Create a global skill named `fixseek`.

Expected global skill shape:

```text
fixseek/
├── SKILL.md
└── agents/
    └── openai.yaml
```

`SKILL.md` should stay short and procedural:

- Trigger conditions: debugging, package discovery, workaround discovery,
  dependency/API/tooling errors, and "before building from scratch" decisions.
- Required behavior: run Fixseek before implementing when the user asks for a
  fix or new tool and the problem may already have existing solutions.
- CLI commands: direct query and stdin forms.
- Result handling: summarize evidence, risks, and next steps.
- Safety: never install, clone, or execute candidate project commands
  automatically.

`agents/openai.yaml` should be generated from the skill metadata using the
skill-creator helper so UI-facing fields stay consistent with `SKILL.md`.

### CLI Simplification

Keep `src/cli/index.ts` as the single CLI entry point. The likely code changes
are:

- Shorten `helpExamples()` to show only common usage.
- Keep `solve` as a compatibility subcommand, but label it as compatibility.
- Keep advanced flags visible in option definitions, but keep common examples
  short so the primary usage is obvious.
- Keep `runSolve` behavior stable so tests and skill commands do not depend on
  a new execution path.

### Documentation

Update docs so each reader has one clear entry point:

- `README.md` and `README.zh-CN.md`: concise human usage.
- `CLAUDE.md`: local agent quick start.
- `docs/ROADMAP.md`: note that agent-first global skill packaging is the active
  next slice after M2.5/M3 planning.
- New global skill `SKILL.md`: agent runtime workflow.

## Data Flow

```text
User request or error log
  -> agent skill trigger
  -> agent extracts problem text and optional stack hints
  -> fixseek CLI
  -> parser/query/provider/scorer/ranker/summarizer
  -> agent summarizes candidates and risks
  -> user decides what to inspect or adopt
```

The skill should not bypass the CLI pipeline. Keeping search deterministic in
the CLI preserves testability and keeps the skill small.

## Error Handling

- If `fixseek` is not on `PATH`, the skill should tell the agent to build or
  install the CLI before using the skill.
- If `GITHUB_TOKEN` is missing, the skill should avoid pretending it performed
  real search.
- If Fixseek returns no candidates, the skill should report that result and
  continue with ordinary engineering only after acknowledging the lack of
  external evidence.
- If output contains warnings, the agent must surface them in its summary.

## Testing And Validation

### CLI Tests

Update or add tests for:

- Help text focuses on direct usage, stdin, real mode, language, and result
  limit.
- `solve` still works as a compatibility command.
- Advanced options still parse correctly even if help text de-emphasizes them.

### Skill Validation

Use skill-creator validation tooling:

```bash
python /Users/peng/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/peng/.codex/skills/fixseek
```

Also run a local smoke check:

```bash
fixseek "reasoning_content error with Claude Code"
```

If real credentials are configured, run:

```bash
fixseek --real "reasoning_content error with Claude Code"
```

### Full Project Verification

Before handoff:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

If `npm run lint` fails because the repository lacks a usable ESLint
configuration, report that separately rather than changing lint setup as part of
this slice.

## Implementation Decisions

- Advanced CLI flags should remain supported and visible in option definitions,
  but the help examples and docs should emphasize the common direct-query,
  stdin, real-mode, language, and result-limit flows.
- For this machine, create the global skill directly at
  `/Users/peng/.codex/skills/fixseek`. The skill contents must not depend on the
  absolute repository path.
- Do not add `--json` in this slice. Treat structured output as a future
  integration feature after the agent skill proves useful with existing CLI
  output.

## Recommended Implementation Order

1. Update CLI help/tests while preserving behavior.
2. Update README and local agent docs for simplified usage.
3. Create global `fixseek` skill with concise `SKILL.md`.
4. Generate `agents/openai.yaml`.
5. Validate the skill and run project verification.

This order keeps product behavior stable before adding the global agent entry
point.
