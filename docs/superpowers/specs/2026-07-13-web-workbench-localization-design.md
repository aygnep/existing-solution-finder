# Web Workbench and Localization Design

## Goal

Replace the bare Web Solution Guide with a dark, responsive solution workbench
and provide instant Chinese/English rendering for system-generated discovery
content and Markdown exports.

## Scope

The workbench uses a desktop two-column layout: a focused discovery form on the
left and a result workspace on the right. On narrow screens, the columns stack.
The header exposes the current real/mock state and an always-visible Chinese /
English selector. The Web Guide defaults to real mode; provider partial success,
empty, skipped, and failed states remain visible.

Language selection stays in React session state. It does not alter the discovery
request and does not trigger a new provider run. Evidence titles, excerpts,
repository names, and other sourced material stay in their original language.

## Localization Architecture

Discovery results remain language-neutral. The core exposes formatters that
derive match reasons and next steps from a candidate's stable score breakdown,
candidate type, metadata, and URL. Safety warnings gain stable codes and
structured parameters alongside their existing English text. Validation step IDs
are treated as stable codes. The CLI keeps rendering English by default but
uses the same formatters for Chinese output.

The Web app imports the shared formatter and message catalog. A selected
`Language` renders all interface labels, candidate explanations, warnings,
validation instructions, provider states, and exports immediately. Export
functions accept an optional language argument and apply the same formatter.
No LLM or network translation is introduced.

## Interface

The left discovery panel contains problem text, editable stack and constraint
lists, provider checkboxes, and one primary search action. The right workspace
shows the generated plan before the first run, then a compact provider-status
strip and ranked candidate cards. Each card presents the localized match reason,
score and trust level, evidence links, visible warnings, validation steps,
selection, and export actions.

The dark theme uses a restrained charcoal background, high-contrast text,
distinct primary actions, and explicit text/icon labels for trust and failure
state. Color supplements rather than replaces warning and provider-state text.

## Error Handling and Verification

Gateway failures show a localized recovery message. A provider's skipped,
failed, empty, or complete state remains visible without discarding successful
candidates from other providers. No credentials reach browser payloads.

Tests cover semantic reason and warning formatting in both languages, localized
exports, instant language changes without a second discovery call, real-mode
requests, provider state visibility, and responsive layout classes. Existing
core, Web, and Playwright checks remain required.
