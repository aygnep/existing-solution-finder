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

**Template:** `"<tool_A>" "<tool_B>" (integration | proxy | compatible | wrapper)`

**Example:**
```
"OpenCode Go" "Claude Code" proxy
"DeepSeek" "Anthropic" compatible
"DeepSeek" "reasoning_content" "OpenAI compatible"
```

### 3. GitHub Repository Queries
Target repositories that directly address the problem. Use `site:github.com` or GitHub's `repo:` and `topic:` filters.

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
2. **Max queries per problem:** 15 (3 per category). Beyond this, result quality degrades.
3. **Deduplication:** identical queries must not be sent twice across providers.
4. **Quotes:** always wrap multi-word tokens in quotes to avoid broad match noise.
5. **Language hint:** append `typescript` or `go` or `python` only when the problem is clearly language-specific.

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

## Example: Full Query Set

**Input:**
```
Claude Code + OpenCode Go + DeepSeek reasoning_content error
```

**Parsed tokens:**
- Error tokens: `reasoning_content`
- Tools: `Claude Code`, `OpenCode Go`, `DeepSeek`
- Context: API proxy, LLM

**Generated queries:**
```
# Category 1 – Exact Error
"reasoning_content" "Claude Code"
"reasoning_content" "DeepSeek"
"reasoning_content" filter proxy

# Category 2 – Stack Compat
"OpenCode Go" "Claude Code" proxy
"DeepSeek" "Anthropic" compatible proxy
"DeepSeek" "Claude Code" integration

# Category 3 – GitHub Repos
site:github.com "Claude Code" "OpenAI compatible" proxy
site:github.com DeepSeek "reasoning_content" strip

# Category 4 – GitHub Issues
site:github.com "reasoning_content" "Claude Code" issue
site:github.com "OpenCode" "DeepSeek" issue

# Category 5 – Alternatives
OpenAI API proxy remove extra fields middleware
LLM response transformer proxy typescript
```
