# 一、推荐开发顺序

## 第 0 步：先写项目边界文档

建议先建这些文件：

```text
docs/
  PRODUCT_SPEC.md
  ARCHITECTURE.md
  SEARCH_STRATEGY.md
  SCORING_RULES.md
  SAFETY_RULES.md
  CLAUDE_CODE_RULES.md
```

不用写得很长，但要明确。

---

## 第 1 步：定义 MVP

MVP 只做一件事：

```text
用户输入一段问题 / 错误日志
↓
系统抽取关键词
↓
生成多组搜索 query
↓
调用 GitHub / Web 搜索
↓
抓取候选项目
↓
评分
↓
输出推荐工具、理由、风险、使用步骤
```

不要一开始做：

```text
自动安装工具
自动修改用户环境
自动执行未知 GitHub 项目
自动提交代码
```

这些都放到后期。

---

## 第 2 步：先做 CLI，不要先做前端

比如：

```bash
tool-resolver ask "Claude Code OpenCode Go DeepSeek reasoning_content error"
```

输出：

```text
1. oc-go-cc
   Fit: 92/100
   Why: README explicitly mentions Claude Code, OpenCode Go, reasoning_content
   Risk: New project, low stars
   Next step: try local proxy configuration

2. claude-code-router
   Fit: 76/100
   Why: Supports Claude Code routing and provider transformation
   Risk: Less specific to OpenCode Go
```

CLI 版本好处是：

* Claude Code 更容易开发
* 容易测试
* 不用先纠结 UI
* 后面可以复用成 API / Web

---

## 第 3 步：先实现离线分析，再接搜索

第一版可以先不联网，输入一段文本，输出结构化解析：

```json
{
  "problem_type": "api_compatibility",
  "software": ["Claude Code", "OpenCode Go", "DeepSeek"],
  "error_terms": ["reasoning_content", "thinking mode"],
  "protocols": ["Anthropic Messages API", "OpenAI Chat Completions"],
  "desired_solution": ["proxy", "router", "adapter"],
  "search_queries": [
    "\"reasoning_content\" \"Claude Code\"",
    "\"OpenCode Go\" \"Claude Code\" proxy",
    "\"Anthropic\" \"OpenAI\" \"Claude Code\" router"
  ]
}
```

这个模块最关键，叫：

```text
Problem Parser
```

它决定整个项目聪不聪明。

---

## 第 4 步：接 GitHub 搜索

优先接 GitHub，而不是全网搜索。

原因：

* 你的目标是找已有工具
* 工具大多在 GitHub
* README / issue / stars / updated_at 都能用来评分
* 结果结构化，适合程序处理

搜索源优先级：

```text
GitHub Repositories
GitHub Issues
GitHub Code Search
官方文档
Reddit / HN / 博客
```

---

## 第 5 步：实现评分系统

这是项目的核心竞争力。

不要只看 stars。新项目可能 star 少，但正好解决问题。

建议评分：

```text
总分 100：

精确错误命中：25
技术栈命中：20
README 证据：15
最近维护：10
安装说明清晰：10
issue 活跃度：5
示例配置：5
安全风险：-20
过期风险：-10
```

比如 `oc-go-cc` 虽然新，但因为精确命中：

```text
Claude Code
OpenCode Go
Anthropic
OpenAI Chat Completions
reasoning_content
thinking blocks
```

所以分数应该很高。

---

## 第 6 步：输出“可执行建议”，不是只给链接

你的项目不要只说：

```text
可能有用：xxx
```

而要输出：

```text
推荐使用 oc-go-cc。

理由：
- 它明确支持 Claude Code 到 OpenAI Chat Completions 的转换
- 它明确处理 reasoning_content
- 它针对 OpenCode Go

风险：
- 项目较新
- 需要手动配置本地代理
- 不建议直接暴露 API key

下一步：
1. 安装
2. 设置 ANTHROPIC_BASE_URL
3. 启动本地代理
4. 先关闭 thinking 测试
```

这才是真正有价值的地方。
