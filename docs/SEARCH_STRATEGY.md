# Search Strategy

## Overview

For each problem, the query generator produces queries in **five categories**. These are executed against multiple providers (GitHub Search API, web search, npm registry) and results are merged before scoring.

## The Five Query Categories

### 1. Exact Error Queries
Target the verbatim error tokens extracted from the input. Best for finding GitHub issues and Stack Overflow discussions that reference the identical error.

**Template:** `"<error_token_1>" "<error_token_2>" [stack_name]`

**Example:**
```
"reasoning_content" "Claude Code"
"ECONNREFUSED" "Docker" "host.docker.internal"
```

### 2. Stack Compatibility Queries
Target tool combinations and known integration pain points.

**Template:** `"<tool_A>" "<tool_B>" compatibility`, or `proxy` when the input explicitly asks for a bridge, proxy, or adapter

**Example:**
```
"OpenCode Go" "Claude Code" proxy
"DeepSeek" "Anthropic" compatible
"DeepSeek" "reasoning_content" "OpenAI compatible"
```

### 3. GitHub Repository Queries
Target repositories that directly address the problem. Web queries may use `site:github.com`; the GitHub API adapter removes that prefix.

**Template:** `site:github.com "<tool>" "<feature_keyword>"`

**Example:**
```
site:github.com "Claude Code" "OpenAI compatible" proxy
site:github.com DeepSeek "reasoning_content" filter
```

### 4. GitHub Issue Queries
Target open and closed issues that describe the same symptom, especially useful for known bugs.

**Template:** `site:github.com/issues "<error_token>" OR "<symptom>"`

**Example:**
```
site:github.com "reasoning_content" issue
"Claude Code" "DeepSeek" issue workaround
```

In real GitHub mode, this category is routed to the GitHub Issues Search API.
Issue results are returned as normal candidates with `candidateTypeHint: 'issue'`
so the existing scorer, ranker, and summarizer can compare them with repository,
package, documentation, and workaround candidates.

### 5. Alternative Solution Queries
Broaden the search to find tools that solve the same underlying need differently.

**Template:** `<goal> (alternative | workaround | instead of <problematic_tool>)`

**Example:**
```
OpenAI API proxy strip extra fields
LLM proxy middleware response transformer
Claude Code custom provider workaround
```

---

## Query Generation Rules

1. **Token extraction order:** exact error strings → tool names → version numbers → general keywords.
2. **Max queries per problem:** 15 (3 per category). The implementation also segments Chinese text and uses broad keyword fallbacks when no known stack or exact error is found.
3. **Deduplication:** identical queries must not be sent twice across providers.
4. **Quotes:** wrap multi-word tokens in quotes to avoid broad match noise.
5. **Solution terms:** use `proxy` and `middleware` for bridge or adapter problems; do not inject them into unrelated compatibility searches.

A provider may report `partial` when one query fails but other queries succeed. Retained results remain visible with the coverage gap.

---

## Provider Mapping

| Category | GitHub Search | Web Search | npm Registry |
|---|---|---|---|
| Exact Error | ✅ issues | ✅ | ❌ |
| Stack Compat | ✅ code | ✅ | ❌ |
| GitHub Repos | ✅ repos | ✅ | ❌ |
| GitHub Issues | ✅ issues | ✅ | ❌ |
| Alternatives | ✅ repos | ✅ | ✅ |

---

## Inspect the Actual Query Set

Run `fixseek --json --mock "your problem"` and read `result.searchPlan`. The
generator is deterministic, but the exact query set depends on extracted error
tokens, known stack names, and Chinese or English keywords. The real mode uses
the same plan and searches configured providers.
