# Local installation and operation

Fixseek is a local discovery tool. Search results need source review and actual
validation; scores do not certify a fix. Node.js 22.12 or newer is required;
Node 22 LTS is the reference runtime. No account or subscription is included.

## Install a reviewed local package

From the source checkout:

```sh
npm ci
npm run build
npm pack --ignore-scripts
```

Inspect the archive before sharing it. Install the resulting file on the target
machine (replace the path with your actual archive):

```sh
npm install -g /absolute/path/fixseek-0.4.0-beta.1.tgz
fixseek doctor
fixseek --mock --json "Vite module not found"
fixseek-web
```

Open http://127.0.0.1:4174. The same loopback Fastify process serves the compiled
Web UI and discovery API. Stop it with Ctrl+C. The port is fixed at 4174;
startup fails if it is already occupied. No Vite or development dependencies
are needed by the installed package. From source, use `npm run web:start`
after building. `npm run web:dev` remains a development command.

## Configuration

Copy the package's `.env.example` to `~/.config/fixseek/.env`, or set
`FIXSEEK_ENV_FILE` to an absolute configuration path. Locate a global package
with `npm root -g` (the template is under `fixseek/.env.example`). Never copy
real credentials into an archive. Existing process variables take precedence;
otherwise cwd `.env` takes precedence over the user configuration file.

`fixseek doctor` checks runtime and configuration without network calls and
prints credential presence only. It does not check token validity or provider
connectivity. npm needs no credential; GitHub needs `GITHUB_TOKEN`; web search
needs `WEB_SEARCH_API_KEY` and optionally `WEB_SEARCH_PROVIDER` (default Brave).
Jev is explicit opt-in and needs `TYPESAFE_API_KEY`; Laya needs a separately
installed local service. See [Laya](LAYA_LOCAL.md).

```sh
fixseek --provider npm --json "Vite ESM CommonJS SSR interop"
```

Missing providers are reported as skipped. Read complete/partial/empty/failed
states before interpreting results. Jev and web search may incur third-party
fees; only enable configured providers intentionally.

## Install the agent skill

The archive includes `skills/fixseek/SKILL.md`. Copy that directory into the
agent's skill directory (for Codex, `~/.codex/skills/fixseek`), reviewing any
existing copy before replacement. Restart or reload the agent to discover it.
The skill requires the CLI on PATH. See [agent workflow](AGENT_WORKFLOW.md).

## Privacy and limitations

Problem, stack, and constraints are redacted at the shared discovery boundary
before query generation; provider excerpts and exports are also redacted. This
uses patterns for common credentials, not a guarantee against every secret
format. Review logs before submission. Local browser text can still contain
what you typed. Search providers receive sanitized queries, and opt-in
rerankers receive sanitized problem text and bounded candidate excerpts.

The package includes code, compiled UI, templates, skill, and operating guides.
It does not contain credentials, search-result archives, benchmark snapshots,
model weights, or third-party service access. Feedback stays local and does not
currently train or alter ranking. Keep the bundled MIT license.

Maintainers can reproduce the isolated archive check with `npm run verify:package`.
The check needs registry access to install dependencies, uses synthetic secrets
and mock discovery, requires port 4174 to be free, and removes its temporary
installation and gateway process on completion.
