# Real Quality Benchmark Design

## Goal

Create a real-provider quality evaluation loop for Fixseek that measures discovery quality against a versioned, human-reviewed benchmark without exposing credentials or destabilizing the ordinary test suite.

## Scope

This phase implements only the benchmark and evaluation workflow. It does not add full-page evidence extraction, Web Solution Guide controls, or ESLint configuration.

## Architecture

The benchmark is a separate module and command-line entry point. It reads versioned benchmark cases, obtains real searchers through `createDiscoverySearchers('real')`, and calls the existing `discoverSolutions` pipeline for every case. It never duplicates query generation, provider selection, scoring, grouping, safety warnings, or validation behavior.

The evaluator reduces each `DiscoveryResult` into a credential-free report containing the case identifier, provider state, elapsed time, candidate URLs, titles, source kinds, scores, warnings, and the explicit quality checks. It compares that report with a committed baseline snapshot. Normal unit tests use fixtures and injected searchers only; real network evaluation is an explicit command.

## Benchmark Data

The repository stores five to eight non-sensitive developer troubleshooting cases. Each case contains:

- a stable identifier and problem statement;
- stack, constraints, enabled providers, and maximum result count;
- required provider coverage;
- approved candidate matchers based on canonical URL or package name;
- the number of top ranked candidates to inspect.

Each case defines a relevance check that passes when an approved matcher occurs among the configured top candidates. Cases cover exact errors, dependency interoperability, Docker or network failures, and npm ecosystem queries.

## Evaluation Semantics

The evaluator records:

- relevance: whether each case finds an approved candidate in its top-N results;
- provider coverage: configured providers that complete with results;
- visible safety: warnings attached to candidates that have recorded risk signals;
- reliability: empty, skipped, and failed provider counts;
- performance: elapsed milliseconds per case and provider run.

A result is **regressed** when a previously passing relevance check fails, a required provider loses a completed result without being classified as inconclusive, or a baseline safety warning disappears. Newly discovered candidates and score improvements are reported but do not fail evaluation.

A result is **inconclusive** when a required credential is absent, a provider is skipped, or a provider fails due to a runtime, rate-limit, or timeout condition. Inconclusive runs are visible in the report and return a distinct non-zero command outcome; they are not reported as product-quality regressions.

## Credentials and Snapshots

Credentials remain solely in environment variables and provider code. Reports, snapshots, browser payloads, and console output never contain environment-variable values, authorization headers, or unredacted provider error messages.

The default real benchmark command is read-only. Baseline snapshots are replaced only by an explicit `--update-baseline` flag after a human reviews the generated diff. The update path writes a deterministic, redacted snapshot to a tracked project file.

## Testing and Acceptance

Unit tests cover benchmark parsing, report reduction, match evaluation, regression comparison, inconclusive classification, redaction, and process exit decisions using deterministic fixture results. The existing default Jest suite must remain offline.

Acceptance requires:

1. A documented explicit command runs real evaluation using configured credentials.
2. It emits a machine-readable redacted report and a readable summary.
3. It exits non-zero for a regression or inconclusive run, with distinct reasons.
4. Baseline updates require `--update-baseline`.
5. The full unit suite, typecheck, and build verify the changes.
