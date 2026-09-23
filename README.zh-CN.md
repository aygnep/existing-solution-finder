# Fixseek

在动手修 bug / 造轮子之前，先搜索已有解决方案。

[English](./README.md)

## 这是什么？

Fixseek 是一个命令行工具。你给它一段错误日志、问题描述或技术栈关键词，它会帮你搜索可能已有的解决方案、GitHub 项目、GitHub issues、npm 包、workaround 和相关工具。

它不是自动修复工具，也不会替你执行未知命令。它更像是一个“先查一下有没有人已经踩过坑”的搜索助手。

### 给 AI 编程 Agent 使用

Agent 可以在选依赖或写 workaround 前运行 `fixseek --json`。结果包含检索词、来源链接、候选方案、风险提示，以及每个 provider 的状态。Agent 再打开原始来源，核对版本和当前项目，并验证拟采用的修改。Fixseek 不让模型凭空编造来源，也不自动执行搜索结果中的命令。

```bash
fixseek --json --stack "Vite,Node.js" "pnpm 安装后模块找不到"
```

JSON 会区分 `complete`、`partial`、`empty`、`skipped` 和 `failed`；`partial` 表示保留了成功查询的结果，同时有其他查询失败。Agent JSON 封装版本为 `1.2`。可复用的说明见 [Codex Skill](skills/fixseek/SKILL.md)。

## 适合什么场景？

- 遇到陌生报错，不想从零开始 debug。
- 想知道某个问题有没有现成 GitHub issue。
- 想找是否已有 npm 包或 CLI 工具解决这个问题。
- 想在写新工具前确认有没有类似项目。
- 想把一段错误日志直接丢进去搜索。
- 想快速整理候选方案、风险和下一步。

## 安装

```bash
npm install -g fixseek
```

npm 仓库目前提供稳定版 0.1.0。本仓库中的 0.3.0 beta 改动可用 `npm install && npm run build` 在本地构建。

## 快速开始

```bash
fixseek "Claude Code DeepSeek reasoning_content error"

cat error.log | fixseek --stdin

fixseek --stack "Node.js,Docker" "container networking issue"
```

CLI 默认访问真实 provider。npm 只需要能联网；配置凭据后会同时使用 GitHub
和 Web。`--mock` 只用于确定性的测试和演示。

## 常用命令

```bash
# 直接查询
fixseek "问题描述"

# 从 stdin 读取错误日志
cat error.log | fixseek --stdin

# 使用真实搜索（默认行为）
fixseek "vite module not found"

# 真实 npm 搜索（不需要 token，但需要网络）
fixseek --provider npm "ESM CommonJS package error"

# 真实 GitHub 搜索（需要 GITHUB_TOKEN）
fixseek --provider github "vite module not found"

# 真实 Web 搜索（需要 WEB_SEARCH_API_KEY）
fixseek --provider web "vite module not found"

# 给 coding agent 使用的稳定 JSON 输出
fixseek --json --stack "Vite,Node.js" \
  --constraints "不能升级依赖" "vite module not found"

# 可选：用 Jev 重排交接候选
fixseek --json --reranker jev "pnpm 安装后 Vite 找不到模块"

# 中文输出
fixseek --lang zh "reasoning_content 报错"

# 限制结果数量
fixseek --max-results 5 "npm package ESM CommonJS error"
```

### 可选 Jev 交接

在本机 `.env` 配置 `TYPESAFE_API_KEY` 后，用 `--reranker jev` 或 Web 界面的复选框显式开启。Fixseek 会把问题、技术栈、约束和截短的来源摘录发送给 TypeSafe AI，让 Jev 在较宽的候选池上分别判断症状相关性、约束兼容性和证据充分性，再输出少量交接候选。排序先看相关性与兼容性中较弱的一项，再看证据概率。`result.handoff` 最多包含 3 个非阻断候选及其来源链接；规则分数和风险提示仍保留。Jev 返回的概率只是排序信号，不证明方案有效。

没有 Key、处于 mock 模式或 API 调用失败时，`result.reranking` 会标为 `skipped` 或 `failed`，并回退到原有规则排序。默认模型固定为 `jev-1.13.0`，可用 `JEV_MODEL` 修改；未显式开启时不会调用 Jev。参见 TypeSafe 的 [API 文档](https://docs.typesafe.ai/api)。

TypeSafe 官方说明 Jev 的英文任务表现目前更强，中文输入需要单独评估。本 beta 开发时没有可用的 TypeSafe API Key，因此完成的是离线接口、回退和界面验证，尚未验证真实 Jev 重排的质量。

### 高级选项

```bash
# 兼容旧式子命令
fixseek solve "问题描述"

# 补充技术栈上下文
fixseek --stack "Node.js,Docker" "container networking issue"

# 补充约束或读取结构化 agent 上下文
fixseek --constraints "开源,不能使用云服务" "container networking issue"
fixseek --json --context-file ./fixseek-context.json

# 限定搜索 provider
fixseek --provider github "vite module not found"

# 显式测试/演示模式或调整日志级别
fixseek --mock "dependency resolution error"
fixseek --log-level debug "dependency resolution error"
```

## 配置

如果要使用 GitHub provider：

```bash
cp .env.example .env
# 编辑 .env，填入 GITHUB_TOKEN
fixseek --provider github "vite module not found"
```

Fixseek 依次读取当前目录的 `.env` 和 `~/.config/fixseek/.env`，已经存在的
环境变量不会被覆盖。也可以用 `FIXSEEK_ENV_FILE` 指定唯一的配置文件。

当前支持的环境变量：

- `GITHUB_TOKEN`: GitHub 搜索需要；mock 模式不需要。
- `WEB_SEARCH_PROVIDER`: 可选 web 搜索 provider，支持 `brave` 或 `serpapi`，默认 `brave`。
- `WEB_SEARCH_API_KEY`: web 搜索 provider 的 API key。
- `TYPESAFE_API_KEY`: 可选，仅显式开启 Jev 重排时使用；不会发送到浏览器。
- `JEV_MODEL`: 可选，默认 `jev-1.13.0`。
- `FIXSEEK_ENV_FILE`: 可选，显式指定环境变量文件。
- `FIXSEEK_OUTCOME_FILE`: 可选，反馈 JSONL 路径；默认是 `~/.config/fixseek/outcomes.jsonl`。
- `LOG_LEVEL`: `debug`、`info`、`warn`、`error`，默认 `warn`。
- `MAX_RESULTS_PER_PROVIDER`: 每个 provider 的最大返回数量，默认 `10`。
- `REQUEST_TIMEOUT_MS`: 请求超时时间，单位毫秒，默认 `10000`。

不要提交 `.env`，不要把真实 token 写进代码、README 或 issue。

## Coding Agent 工作流

当陌生问题能从外部证据获益时，agent 可先运行 `fixseek --json`，检查每个 provider 的
`complete`、`partial`、`empty`、`skipped` 或 `failed` 状态，并在条件允许时核验至少
两个独立来源。分数只是检索信号，不是修复已被证明有效。agent 仍需推导根因、
提出隔离验证与回滚方案。执行陌生候选命令或有实质风险的操作前应取得授权；用户已授权的常规代码修改可以继续进行。

### Agent Skill 使用方式

如果 Agent 环境已经安装 Fixseek Skill，可以直接用自然语言触发，例如：

> 在修改项目之前，使用 Fixseek 调查这个 Vite 模块解析错误。

仓库中的 [Skill 文件](skills/fixseek/SKILL.md) 是编排与安全约束层：它负责收集错误、技术栈、版本、限制条件和已尝试方案，
调用 `fixseek --json`，检查每个 provider 的状态，核验来源证据，并给出验证与回滚
建议。Fixseek CLI 才是真正执行搜索的入口。如果环境中没有安装 Skill，Agent 也
可以直接调用 CLI，遵循相同工作流。

Web 解决方案向导下载的“agent skill 草稿”是根据所选搜索结果生成的后续工作材料，
并不是已经安装到 Agent 环境中的 Fixseek 集成 Skill。

验证后记录实际结果：

```bash
fixseek feedback \
  --problem "pnpm install 后 vite module not found" \
  --candidate-url "https://github.com/example/project/issues/123" \
  --outcome useful \
  --notes "已在隔离复现中确认" \
  --json
```

结果可选 `useful`、`not-useful` 或 `unsafe`。反馈保存在本地，目前不会自动参与排序。验证失败时，把已尝试方案和
新错误加入 context file 后重新搜索。完整流程见
[`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md)。

## 本地开发

```bash
npm install
npm run build
npm test
npm run typecheck
```

### Web 解决方案向导（本地预览）

无账号的 Web 解决方案向导会将一个技术问题转成可查看的搜索计划、带证据的候选方案、安全警告，以及可下载的 Markdown 报告或 agent skill 草稿。

```bash
npm install
npm run build
npm run web:dev
```

打开 <http://127.0.0.1:5173>。本地网关监听 4174 端口，provider 密钥始终留在浏览器之外；会话默认不会持久化。mock 模式确定且无需凭据，real 模式使用上文列出的环境变量。

当前 GitHub 仓库仍是：
[aygnep/existing-solution-finder](https://github.com/aygnep/existing-solution-finder)。
产品名已经统一为 Fixseek，仓库名之后可以再决定是否迁移。

## 常见问题

### 为什么叫 Fixseek？

因为它的目标不是直接替你修复问题，而是先帮你 seek existing fixes：找到别人已经留下的修复方案、讨论、包、工具或 workaround。

### 和直接问 AI 有什么区别？

AI 很适合解释和推理，但它不一定知道最新的 issue、仓库或 npm 包。Fixseek 的定位是先找已有证据和候选方案，再由你判断是否采用。

### 为什么有时候结果不准？

搜索质量取决于输入里的错误关键词、技术栈和 provider 数据。可以尝试加上 `--stack`，或用更具体的错误信息重新搜索。

### GitHub token 是否必须？

只使用 npm 或 `--mock` 时不需要。GitHub provider 需要 `GITHUB_TOKEN`，
Web provider 需要 `WEB_SEARCH_API_KEY`。

### npm 安装后命令找不到怎么办？

先确认全局安装成功：

```bash
npm list -g fixseek
```

如果安装成功但命令不可用，检查 npm global bin 目录是否在 `PATH` 中：

```bash
npm bin -g
```

然后把输出目录加入 shell 的 `PATH`。

## 安全边界

- 不自动 clone 仓库。
- 不自动运行 `npm install`。
- 不执行未知脚本。
- 不泄露 token。
- 不保证搜索结果一定正确或安全。

## License

MIT
