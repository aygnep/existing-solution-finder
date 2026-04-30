# Fixseek

在动手修 bug / 造轮子之前，先搜索已有解决方案。

[English](./README.md)

## 这是什么？

Fixseek 是一个命令行工具。你给它一段错误日志、问题描述或技术栈关键词，它会帮你搜索可能已有的解决方案、GitHub 项目、GitHub issues、npm 包、workaround 和相关工具。

它不是自动修复工具，也不会替你执行未知命令。它更像是一个“先查一下有没有人已经踩过坑”的搜索助手。

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

## 快速开始

```bash
fixseek "Claude Code DeepSeek reasoning_content error"

cat error.log | fixseek --stdin

fixseek --stack "Node.js,Docker" "container networking issue"
```

默认使用 mock 模式，不需要 token，也不会访问真实搜索 API。

## 常用命令

```bash
# 推荐用法：直接查询
fixseek "问题描述"

# 兼容旧式子命令
fixseek solve "问题描述"

# 从 stdin 读取错误日志
cat error.log | fixseek --stdin

# 使用真实 provider
fixseek --real --provider github "vite module not found"

# 使用 mock provider
fixseek --mock "Claude Code DeepSeek reasoning_content error"

# 限制结果数量
fixseek --max-results 5 "npm package ESM CommonJS error"

# 补充技术栈上下文
fixseek --stack "Node.js,Docker" "container networking issue"

# 调整日志级别
fixseek --log-level warn "dependency resolution error"

# 中文输出标签
fixseek --lang zh "Claude Code + DeepSeek reasoning_content 报错"
```

## 配置

如果只使用默认 mock 模式，不需要配置环境变量。

如果要使用 real GitHub 模式：

```bash
cp .env.example .env
# 编辑 .env，填入 GITHUB_TOKEN
fixseek --real --provider github "vite module not found"
```

当前支持的环境变量：

- `GITHUB_TOKEN`: real GitHub 模式需要；mock 模式不需要。
- `WEB_SEARCH_PROVIDER`: 可选 web 搜索 provider，目前支持 `brave` 或 `serpapi`。
- `WEB_SEARCH_API_KEY`: web 搜索 provider 的 API key。
- `LOG_LEVEL`: `debug`、`info`、`warn`、`error`，默认 `warn`。
- `MAX_RESULTS_PER_PROVIDER`: 每个 provider 的最大返回数量，默认 `10`。
- `REQUEST_TIMEOUT_MS`: 请求超时时间，单位毫秒，默认 `10000`。

不要提交 `.env`，不要把真实 token 写进代码、README 或 issue。

## 本地开发

```bash
npm install
npm run build
npm test
npm run typecheck
```

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

默认 mock 模式不需要。只有使用 `--real --provider github` 或需要 GitHub real provider 时，才需要 `GITHUB_TOKEN`。

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
