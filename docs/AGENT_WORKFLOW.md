# Agent-First Workflow

Fixseek retrieves and evaluates existing evidence. The calling agent remains
responsible for understanding the active repository, proposing a change, asking
for approval when execution is risky, and validating the result.

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
3. **Check provider health**
   - Distinguish `complete`, `empty`, `skipped`, and `failed`.
   - Do not describe a failed or rate-limited provider as having no results.
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
   - Obtain explicit approval before running commands copied from a result.
7. **Record and refine**
   - Record the selected candidate as `useful`, `not-useful`, or `unsafe`.
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
