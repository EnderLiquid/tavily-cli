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
description: 用本地 tavily-cli 搜索网页、读取正文、发现站内链接和抓取多页内容。需要查最新信息、核实事实、找可引用的来源或读取指定网页时使用。
---
```

## 正文结构

| 小节 | 内容 |
|---|---|
| 选命令 | 四行对照：要事实用 search，有 URL 用 extract，找页面用 map，抓一节用 crawl |
| search | 一般用 advanced，简单查证可用 basic；按待核实要点拆查询，独立查询可并行；按线索验证，候选从结果建；写报告按小节检索；生成答案只作摘要 |
| extract | 单次不超过 20 个 URL，默认抽取正文；`--query` 配合 `--chunks-per-source` 定位长页面；空结果、脚本渲染或表格内容可用 advanced；批量抽取只重试失败页 |
| map 与 crawl | 先 map 找单页或探路；从具体栏目 URL 开始，用路径和 limit 收紧范围；从 depth 1、limit 20 起步；用 instructions 按语义聚焦，配合 chunks 控制片段数；失败页用 extract advanced 重试 |
| 检索质量 | 一般事实用独立来源互证；发布、归属、官方数字和机构决定查一手资料；回答前补证并注明未核实内容 |
| 额度 | 各命令的计费规则、账号共享额度；退出码 3 时查 usage，按状态指引用户添加 key 或同步额度 |
| 输出 | stdout 输出主结果；`--json` 输出完整响应或错误 JSON；两种保存方式与路径输出；部分失败的检查和说明；控制上下文长度与搜索片段长度 |

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
