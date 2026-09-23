# Agent-First Workflow

Fixseek retrieves and evaluates existing evidence. The calling agent remains
responsible for understanding the active repository, proposing a change, asking
for approval when execution is risky, and validating the result.

## Background Research Mode

When the agent runtime supports background workers and the user has authorized
delegation, Fixseek research can overlap with independent repository work. Send
one bounded, read-only research question to a worker and require real JSON
output, explicit provider states, verified source URLs, and evidence gaps. The
worker must not install packages, run result-derived commands, modify code, or
write outcome feedback without separate authorization.

The main agent should immediately continue work that does not depend on the
search result, such as inspecting the active code, recording versions and
constraints, or defining an isolated validation and rollback. Collect the
worker result at the first decision boundary that needs evidence. Do not repeat
the same search locally or poll continuously. Run synchronously instead when
research is the immediate blocker, the task is too small to overlap, or no
authorized worker is available.

## Closed Loop

1. **Capture the problem**
   - Preserve the exact error text.
   - Record the stack, versions, operating system, package manager, constraints,
     recent changes, and fixes already attempted.
2. **Search real providers**
   - Use real mode for actual engineering work.
   - Request machine-readable output so provider state, queries, evidence,
     warnings, and validation steps remain structured.
   - Mock mode is only for deterministic tests and demonstrations.

   ```bash
   fixseek --json \
     --stack "runtime,framework" \
     --constraints "project constraints" \
     "exact error and observed behavior"
   ```

   For longer context, pass a JSON file with `problem`, `stack`,
   `constraints`, `attemptedFixes`, and a non-secret `environment` object:

   ```bash
   fixseek --json --context-file ./fixseek-context.json
   ```
   If the user explicitly wants Jev-assisted ranking and a TypeSafe key is
   configured, add `--reranker jev`. Inspect `result.reranking` and
   `result.handoff`; a skipped or failed rerank retains the rule order.
   Jev probabilities do not replace source verification or safety warnings.
3. **Check provider health**
   - Distinguish `complete`, `partial`, `empty`, `skipped`, and `failed`.
   - `partial` retains successful results but signals incomplete query coverage.
   - Do not describe a partial, failed, or rate-limited provider as a clean empty search.
4. **Verify evidence**
   - Open at least two independent sources when two are available.
   - Confirm affected versions, stack compatibility, publication/update date,
     license, and whether maintainers or multiple users confirm the fix.
   - If only one source exists, state that limitation.
5. **Synthesize a proposal**
   - Explain the likely root cause.
   - Map each proposed change to its supporting source.
   - Include an isolated validation command, expected observation, rollback, and
     known risks.
6. **Execute with user control**
   - Never install, clone, execute, or modify code merely because a candidate
     recommends it.
   - Obtain explicit approval before running unknown commands copied from a result or taking a materially risky action. Existing authorization covers ordinary repository edits.
7. **Record and refine**
   - After actual validation, record the selected candidate as `useful`, `not-useful`, or `unsafe`. Feedback remains local and is not an automatic ranking signal.
   - If validation fails, add the attempted change, observed output, and new
     error to the next context and search again.

   ```bash
   fixseek feedback \
     --problem "original problem" \
     --candidate-url "https://source.example/fix" \
     --outcome useful \
     --notes "actual isolated-test observation" \
     --json
   ```

## Agent Output Contract

Before implementation, the agent should report:

- provider coverage and failures;
- the verified sources and relevant excerpts;
- the inferred root cause;
- the recommended change and alternatives;
- the validation and rollback plan;
- uncertainty or disagreement between sources.

Fixseek scores are retrieval signals, not proof. The agent must not present a
high score as confirmation that a candidate solves the active problem.
