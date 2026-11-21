# crawl 的逐页文件保存（--output-dir）

## 状态

- 状态：已完成（2026-11-21）
- 设计：[design.md](design.md)
- 范围：`tavily-cli crawl`
- 性质：实现缺口，已补命令文档与 skill

## 目标

给 `crawl` 增加逐页 Markdown 落盘，让用户和 agent 可以把站点或栏目保存到本地，同时统一输出与错误路由。

## 实现

`tavily-cli crawl <url> --output-dir <dir>` 会递归创建目录，把每个有 `raw_content` 的成功页面写成一个 `.md` 文件。文本模式下 stdout 输出保存路径，`--json` 输出完整响应；保存提示和失败汇总写 stderr。`-o` 仍用于额外保存完整响应，不改变 stdout。

文件名、重名处理、Windows 兼容、选项组合、错误流和测试覆盖见 [design.md](design.md)。

## 关联

- 命令实现：`src/commands/site.ts` 的 `configureCrawl` 与 `runCrawl`
- 输出实现：`src/ui/output.ts`、`src/ui/render.ts`、`src/ui/artifact.ts`、`src/ui/report.ts`
- 命令测试：`tests/cli.test.ts`、`tests/crawl-output.test.ts`
- 命令文档：[docs/cli.md](../../cli.md)
- skill 文档：[docs/skill.md](../../skill.md)
- skill 参数表：[skills/tavily/references/flags.md](../../../skills/tavily/references/flags.md)
- 官方说明：<https://github.com/tavily-ai/skills/blob/main/skills/core/tavily-search/references/crawl.md> 的 “Reading pages or saving them”
