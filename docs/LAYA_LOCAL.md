# Local Laya reranking

[Laya](https://huggingface.co/convaiinnovations/laya) is an independent,
Apache-2.0-licensed decision model, not a TypeSafe Jev checkpoint. Its Python
package serves a Jev-compatible `POST /v1/systemone` API. Fixseek uses this
loopback service for the optional `--reranker laya` mode. No TypeSafe key is
needed, and the local service receives only the problem and bounded candidate
text that Fixseek sends for reranking.

## Install and start

On macOS or Linux with Python 3.12 and `uv`:

```bash
uv venv .venv-laya --python 3.12
uv pip install --python .venv-laya/bin/python 'laya[serve]==0.3.9'
LAYA_HOST=127.0.0.1 LAYA_PORT=8766 LAYA_PRELOAD=1 \
  LAYA_MODELS=english,multilingual LAYA_DEVICE=cpu \
  .venv-laya/bin/laya-serve
```

The first start downloads the English and multilingual checkpoints and can
take several minutes. Keep this terminal open. In another terminal, check:

```bash
curl --fail http://127.0.0.1:8766/health
node dist/cli/index.js --json --reranker laya \
  --stack "Vite,Node.js" "Vite cannot import a CommonJS package during SSR"
```

Run `npm run build` first if `dist/` is absent. `LAYA_PORT` may be changed in
both the server command and Fixseek's ignored `.env`. Fixseek connects only to
`127.0.0.1`; bind the unauthenticated Laya service there, not to the LAN.

## What the handoff means

Laya's Router selects the English or multilingual checkpoint based on the
input. Fixseek asks three yes/no questions per candidate: symptom relevance,
stack and constraint compatibility, and whether the supplied text states
checkable evidence. It evaluates at most 30 candidates. To limit regressions
from a newly added model, the local Laya handoff keeps the first non-blocked
rule-ranked candidate and fills the remaining places from Laya's order.

Read `result.reranking` for `provider: "laya"`, the selected model, and
`strategy: "rule-anchor"`. Each candidate's `decision` preserves the three
Laya probabilities alongside the original rule score and source links. These
probabilities rank candidates for review; they do not verify that a fix works.
If the service is unavailable or returns an invalid response, Fixseek keeps
the rule order and reports `reranking.state: "failed"`.

This setup was exercised on an Apple Silicon Mac with 16 GB RAM using Laya
0.3.9 on CPU. Both English and Chinese requests returned valid Noul answers;
Chinese text routed to the multilingual checkpoint. On five existing real
benchmark cases, pure Laya order helped one target and demoted another, so
Fixseek uses the rule anchor and makes no general quality-improvement claim.
