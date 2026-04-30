# Existing Solution Finder

[English](README.md)

Existing Solution Finder 是一个本地 CLI，帮助开发者从错误日志和问题描述中发现可能已有的工具、GitHub 项目、issue 和 workaround。

它适合在你准备自己写方案之前，先快速查一遍：有没有现成工具、已有 GitHub 讨论、配置绕过方案，或者可以参考的项目。

## 适合解决什么问题

- 不知道该搜什么关键词。
- 怀疑已有工具能解决当前问题。
- 想从 GitHub 项目或 issue 中找 workaround。
- 想在自己造轮子前先查已有方案。

## 不适合解决什么问题

- 不保证自动修复错误。
- 不自动安装工具。
- 不替代人工判断安全性。
- 不保证推荐结果一定正确。

## 安装和运行

从源码运行：

```bash
git clone <repo-url>
cd existing-solution-finder
npm install
npm run build
npm start -- solve "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"
```

## Mock 模式

默认是 mock 模式。它使用内置候选数据，不访问真实网络，也不需要 API key。

```bash
npm start -- solve "reasoning_content error with Claude Code + DeepSeek + OpenCode Go"
```

## Real GitHub 模式

Real GitHub 模式会调用 GitHub API，需要配置 `GITHUB_TOKEN`。

```bash
cp .env.example .env
# 编辑 .env，填入 GITHUB_TOKEN。

npm start -- solve --real --provider github "reasoning_content error with Claude Code"
```

## 中文输出示例

```bash
npm start -- solve --lang zh "Claude Code + DeepSeek reasoning_content 报错"
```

`--lang zh` 只翻译 CLI 外层固定标签，例如“最佳匹配”“类型”“匹配分”“匹配原因”“下一步”。工具名、仓库名、URL、错误关键词、API 字段名和原始日志不会被翻译。

## 常用命令

```bash
# 从 stdin 读取
printf '%s\n' "Claude Code + DeepSeek reasoning_content 报错" | npm start -- solve --stdin --lang zh

# 限制结果数量
npm start -- solve --max-results 3 "Claude Code DeepSeek proxy"

# 指定真实 provider
npm start -- solve --real --provider github "reasoning_content error with Claude Code"

# 调整日志级别
npm start -- solve --log-level debug "Claude Code DeepSeek proxy"
```

## 环境变量

根据 `.env.example` 创建 `.env`：

```bash
cp .env.example .env
```

常用变量：

- `GITHUB_TOKEN`: real GitHub 模式需要；mock 模式不需要。
- `WEB_SEARCH_PROVIDER`: 可选 web 搜索 provider，目前支持 `brave` 或 `serpapi`。
- `WEB_SEARCH_API_KEY`: web 搜索 provider 的 API key。
- `LOG_LEVEL`: `debug`、`info`、`warn`、`error`。
- `MAX_RESULTS_PER_PROVIDER`: 每个 provider 的最大返回数量。
- `REQUEST_TIMEOUT_MS`: 请求超时时间，单位毫秒。

不要提交 `.env`，也不要把真实 token 写进代码或文档。

## npm 分发说明

当前项目已做 npm 发布准备，但尚未真正发布。未来可以通过 npm 全局安装：

```bash
npm install -g <package-name>
tool-resolver solve "reasoning_content error with Claude Code"
```

发布前建议确认包名是否沿用当前的 `tool-resolver`，或改为更贴近项目名的 `existing-solution-finder` / `@aygnep/existing-solution-finder`。

## 安全边界

- 不自动 clone 仓库。
- 不自动运行 `npm install` 或其他安装命令。
- 不执行未知脚本。
- 不泄露 token。
- 不会替你判断某个项目一定安全。

## Roadmap

- 更完整的中文输出。
- GitHub Issues 搜索。
- 改进 npm / package registry 搜索。
- 更好的证据提取。
- 更多真实问题 fixtures。

## License

MIT
