---
name: tavily
description: |
  用本地 tavily-cli 完成联网检索：搜索、读取页面、发现站点 URL、抓取站点内容。
  任务需要训练数据之后的事实、新闻、来源或页面正文时使用。
allowed-tools: Bash(tavily-cli *)
---

# tavily-cli

## 选命令

| 你有的 | 你需要的 | 用 |
|---|---|---|
| 一个问题或主题 | 来源、事实、新闻 | `search` |
| 若干 URL | 页面正文 | `extract` |
| 一个站点 | 具体页面的 URL | `map` |
| 站点的一个栏目 | 其中多页内容 | `crawl` |

## search

默认用 advanced 深度，一次取 10 条：

```bash
tavily-cli search 'Rust 2024 edition release notes' --depth advanced --max-results 10
```

- 查询写成搜索引擎能匹配的短语，不要照搬用户的整句话。
- 一个问题拆成几次检索；互不依赖的检索在同一轮里分成多个 Bash 调用。
- 需要官方来源时用 `--include-domains`，它是硬过滤，没有结果就去掉重试。
- 最近的事件加 `--time-range week` 或 `--start-date`。
- 片段不够用时先 `extract` 那一两个页面，不要靠调大 `--max-results` 解决。

## extract

```bash
tavily-cli extract https://example.com/report https://example.com/summary
```

- 单次最多 20 个 URL。
- 每次检查 `failed_results`，并在回答里说明哪些页面没读到。
- `basic` 返回空、或页面靠 JavaScript 渲染时，加 `--extract-depth advanced`。

## map 与 crawl

```bash
tavily-cli map https://docs.example.com --select-paths '/guide/.*' --limit 100
tavily-cli crawl https://docs.example.com --limit 20 --max-depth 2
tavily-cli crawl https://docs.example.com/guide --output-dir .tavily/guide --limit 20
```

先用 map 找到确切页面，再决定要不要 crawl。crawl 按页计费，`--limit` 就是花费上界，默认 50 已经不小。需要把站点或栏目保存到本地时用 `--output-dir`，stdout 会输出保存路径，失败页汇总在 stderr。

## 额度

号池在多个账号之间轮换，正常使用时不需要关心。

- 退出码 3 表示没有可用额度或没有可用 key。运行 `tavily-cli usage` 查看，把结果如实告诉用户。
- 只在遇到退出码 3 时查 `usage`，不要在每次检索前查。
- `usage` 显示 `uncalibrated` 时，请用户执行一次 `tavily-cli usage --sync`。

## 输出

- stdout 是本次命令的结果，诊断、保存路径和失败汇总写 stderr。
- 需要结构化结果时加 `--json`，它会输出完整响应。
- 结果很长时用 `-o .tavily/<name>.json` 额外保存完整响应，stdout 不变；也可以用 shell 重定向只保留文件。
- 要保存站点副本时用 `crawl --output-dir .tavily/<name>`，每个成功页面生成一个 `.md`。
- 文本模式下失败页会汇总到 stderr；`--json` 下检查 `failed_results`。
- 默认每条搜索结果打印 600 字符，`--max-chars 0` 打印全文。

完整参数见 [references/flags.md](references/flags.md)。
