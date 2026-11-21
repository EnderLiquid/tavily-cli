# Agent skill

仓库内附带的 skill 位于 `skills/tavily/`，随项目一起维护，不通过外部仓库安装。

```
skills/tavily/
├── SKILL.md
└── references/
    └── flags.md
```

## 定位

给使用本 CLI 的 agent 提供检索策略，覆盖"什么时候用哪个命令""怎么把额度花在刀刃上""失败后怎么恢复"。它只描述 `tavily-cli` 本身，不涉及 MCP 工具，也不引导使用 research。

## frontmatter

```yaml
---
name: tavily
description: |
  用本地 tavily-cli 完成联网检索：搜索、读取页面、发现站点 URL、抓取站点内容。
  任务需要训练数据之后的事实、新闻、来源或页面正文时使用。
allowed-tools: Bash(tavily-cli *)
---
```

## 正文结构

| 小节 | 内容 |
|---|---|
| 选命令 | 四行对照：要事实用 search，有 URL 用 extract，找页面用 map，抓一节用 crawl |
| search | 默认 `--depth advanced --max-results 10`；查询写成搜索引擎能匹配的短语；一个子问题一次调用；独立检索分多个 Bash 调用并行 |
| extract | 单次不超过 20 个 URL；`basic` 返回空或页面依赖脚本渲染时改 `advanced`；每次检查 `failed_results` |
| map 与 crawl | 先 map 定位再 crawl 小节；crawl 按页计费，用 `--limit` 收紧范围；`--output-dir` 保存站点副本 |
| 额度 | 退出码 3 表示号池不可用，运行 `tavily-cli usage` 查看，把结果如实告诉用户；平时不要轮询 usage |
| 输出 | stdout 是主结果；`--json` 输出完整响应；`-o` 额外保存完整响应；失败汇总写 stderr |

`references/flags.md` 保存四个命令的完整 flag 表、退出码表与错误码表。SKILL.md 只保留决策性内容，细节按需查阅。

## 与官方 skill 的差异

| 维度 | 官方 `tavily-search` | 本项目 |
|---|---|---|
| research | 明确引导切换到 research | 不提供 research |
| 工具面 | 同时适配 MCP 与 `tvly` | 只适配 `tavily-cli` |
| 额度 | 不涉及 | 说明退出码 3 的恢复动作 |
| 篇幅 | 较长，含大量检索方法论 | 保留检索策略，压缩工具说明 |

## 维护约定

命令的 flag 或退出码变化时，同步更新 `references/flags.md`。SKILL.md 里的示例命令必须能直接运行，测试中覆盖一次 `--help` 与示例的一致性。
