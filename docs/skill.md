# Agent skill

仓库内附带的 skill 位于 `skills/tavily/`，随项目一起维护，不通过外部仓库安装。

```
skills/tavily/
├── SKILL.md
└── references/
    └── cli.md
```

## 定位

给使用本 CLI 的 agent 提供检索策略，覆盖"什么时候用哪个命令""怎么把额度花在刀刃上""失败后怎么恢复"。它只描述 `tavily-cli` 本身，不涉及 MCP 工具、安装与 OAuth 登录、自动更新，也不引导使用 research。

## frontmatter

```yaml
---
name: tavily
description: |
  用本地 tavily-cli 完成联网检索：搜索、读取页面、发现站点 URL、抓取站点内容。
  任务需要训练数据之后的事实、新闻、来源或页面正文，或需要核实用户提供的说法时使用。
allowed-tools: Bash(tavily-cli *)
---
```

## 正文结构

| 小节 | 内容 |
|---|---|
| 选命令 | 四行对照：要事实用 search，有 URL 用 extract，找页面用 map，抓一节用 crawl |
| search | 显式 advanced，简单查证可用 basic；查询写成搜索引擎能匹配的短语；独立检索分多个 Bash 调用；顺线索验证，候选从结果建；写报告按小节检索；生成答案只作摘要 |
| extract | 单次不超过 20 个 URL，默认整页；`--query` 配合 chunks 定位长页面；空结果、脚本渲染或表格内容改 advanced；失败页只重试一次 |
| map 与 crawl | 先 map 找单页或探路；crawl 用路径和 limit 收紧，从 depth 1、limit 20 起步；用 instructions 按语义聚焦，配合 chunks 控制片段数；失败页用 extract advanced 重试；部分失败退出 0；output-dir 只用于副本 |
| 检索质量 | 两个独立来源一致即停；回答前补未确认或凭记忆的部分；官方发布、归属、数字与决定回官网或仓库确认 |
| 额度 | 各命令的计费规则、账号共享额度；退出码 3 时查 usage，按状态指引用户添加 key 或同步额度 |
| 输出 | stdout 是主结果；`--json` 输出完整响应且错误也写 stdout；`-o` 额外保存完整响应，首次创建 `.tavily/` 时写 `.gitignore`；`--output-dir` 不写；失败汇总写 stderr；`--max-chars 0` 是片段全文 |

`references/cli.md` 保存完整的命令、参数、输出契约与退出码表，每个参数都有默认值、范围、依赖或成本说明。SKILL.md 只保留决策性内容，细节按需查阅。

## 与官方 skill 的差异

| 维度 | 官方 `tavily-search` | 本项目 |
|---|---|---|
| research | 明确引导切换到 research | 不提供 research |
| 工具面 | 同时适配 MCP 与 `tvly` | 只适配 `tavily-cli` |
| 额度 | 不涉及 | 说明计费规则和退出码 3 的恢复动作 |
| 篇幅 | 较长，含大量检索方法论 | 保留检索推进、停止条件与失败恢复，压缩工具说明 |
| 任务型 skill | research、entity、list、monitor 各自独立 | 只维护核心检索 skill，不覆盖任务工作流 |

## 维护约定

命令的 flag 或退出码变化时，同步更新 `references/cli.md`。SKILL.md 里的示例命令必须能直接运行；改参数时用 `tavily-cli <command> --help` 核对一次，`tests/docs.test.ts` 会检查文档与 `--help` 的参数覆盖。

[SKILL.md 的计费模型](../skills/tavily/SKILL.md#计费模型)与[额度与记账](credit.md#计费模型)保持一致。
