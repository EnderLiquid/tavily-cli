---
name: tavily
description: 用本地 tavily-cli 完成联网检索：搜索、读取页面、发现站点 URL、抓取站点内容。任务需要训练数据之后的事实、新闻、来源或页面正文，或需要核实用户提供的说法时使用。
---

# tavily-cli

`tavily-cli` 是给 agent 用的 Tavily 命令行，内置多账号额度池。

## 选命令

| 你有的 | 你需要的 | 用 |
|---|---|---|
| 一个问题或主题 | 来源、事实、新闻 | `search` |
| 若干 URL | 页面正文 | `extract` |
| 一个站点 | 具体页面的 URL | `map` |
| 站点的一个栏目 | 其中多页内容 | `crawl` |

## search

检索时显式用 advanced 深度，一次取 10 条；简单查证可用 basic：

```bash
tavily-cli search 'Rust 2024 edition release notes' --depth advanced --max-results 10
```

- 查询写成搜索引擎能匹配的短语，不要照搬用户的整句话。
- 一个问题拆成几次检索；互不依赖的检索在同一轮里分成多个 Bash 调用，一个调用只放一条命令，避免 `&`、`$(...)` 和循环。
- 需要官方来源时用 `--include-domains`，默认是硬过滤，没有结果就去掉重试；想保留全网结果时加 `--include-domains-mode prefer`。
- 最近的事件用 `--topic news --time-range week`，或 `--start-date` / `--end-date`。
- 片段不够用时先 `extract` 那一两个页面，不要靠调大 `--max-results` 解决。
- 结果里出现可能的答案就立即验证：用名称加已知细节再搜，或 `extract` 该页。能解释大部分细节的线索先保留，直到有来源反驳；某个细节无法确认，不能据此排除它。
- 搜索落空时先用细节本身重搜，再考虑加名称或过滤；候选列表从结果里建，不凭记忆。
- 某个细节一直查不到时，弄清它指的角色、事件或术语再搜。
- 写报告时按小节分别检索，先把每节的主要来源 `extract` 出来，再动笔。
- `--include-answer` 的答案只是待核对的摘要，不能当来源。

## extract

```bash
tavily-cli extract 'https://example.com/report' 'https://example.com/summary'
```

- 单次最多 20 个 URL，默认取整页。
- 每次检查 `failed_results`，并在回答里说明哪些页面没读到。
- `basic` 返回空、页面靠 JavaScript 渲染、或内容在表格与结构化数据里时，加 `--extract-depth advanced`。
- `--query` 只在长页面里定位一个事实时使用，配合 `--chunks-per-source`；片段在需要的位置被截断时去掉 `--query` 重取。
- 慢页面加 `--timeout 60`。批量抽取时只重试失败页。

## map 与 crawl

```bash
tavily-cli map 'https://docs.example.com' --select-paths '/guide/.*' --limit 50
tavily-cli crawl 'https://docs.example.com' --select-paths '/guide/.*' --limit 20 --max-depth 1
tavily-cli crawl 'https://docs.example.com/guide' --output-dir .tavily/guide --limit 20
```

- 只需要一两个页面、但不知道 URL 时，先用 `map` 找页面，再用 `extract` 读正文。
- 抓取多页时，从 docs 或 blog 子域的目标栏目开始。站点结构未知时先用 `map`，按返回的真实路径设置 `--select-paths`。
- `crawl` 始终显式设 `--limit`，从 `--max-depth 1 --limit 20` 起步；只有目标页埋得深时才加 `--max-depth`。
- 优先用具体栏目 URL 和 `--select-paths` 收紧范围，需要按语义聚焦时再加 `--instructions`。要将多页内容放进上下文时，用 `--instructions` 配合 `--chunks-per-source` 控制每页的片段数。
- 每次检查 `failed_results`，把失败页用 `extract --extract-depth advanced` 单独重试，并告诉用户哪些页面没读到。
- 只为回答问题时不要用 `--output-dir`；它用于保存站点副本。文本模式下 stdout 输出保存路径，失败页汇总在 stderr。

## 检索质量

- 两个独立来源一致即可停；数独立来源，不数结果条数。
- 回答前把草稿里未确认或凭记忆填的部分补一次定向检索。
- 发布、归属、官方数字、具名机构的决定，回官网或仓库确认；二手站点或生成答案不够。

## 额度

### 计费模型

| 接口 | 积分 |
|---|---|
| search basic、fast、ultra-fast | 每次 1 |
| search advanced | 每次 2 |
| extract basic | 每 5 个成功 URL 1 |
| extract advanced | 每 5 个成功 URL 2 |
| map | 每 10 个页面 1，带 `instructions` 时每 10 个页面 2 |
| crawl | map 部分与 extract 部分之和 |

免费额度每月 1000 分，按账号发放。同一账号下的多个 key 共享额度，`/usage` 的 `account` 段是账号级数据，`key` 段是单个 key 的数据。

### 查询与恢复

号池自动在可用账号之间轮换。

- 检索时，只在遇到退出码 3（额度或鉴权问题）后运行 `tavily-cli usage`，查看号池状态并向用户说明结果。
- `usage` 显示未配置 key 时，请用户在自己的终端通过标准输入（stdin）将 key 传给 `tavily-cli keys add <label>`，再运行 `tavily-cli usage --sync` 让新 key 参与轮询。不要在对话中索取 key。
- `usage` 显示 `uncalibrated` 时，请用户执行一次 `tavily-cli usage --sync`。

## 输出

- stdout 是本次命令的结果，诊断、保存路径和失败汇总写 stderr。
- 检索命令需要结构化结果时加 `--json`，它会输出完整响应。`--json` 下的错误 JSON 写 stdout。
- 结果很长时用 `-o .tavily/<name>.json` 额外保存完整响应，stdout 不变。首次创建 `.tavily/` 时会写入 `.gitignore`。保存后用 head、grep 或 node 读取需要的部分。
- 要保存站点副本时用 `crawl --output-dir .tavily/<name>`，每个成功页面生成一个 `.md`。`--output-dir` 不写 `.gitignore`，需要时自行确认该目录已被忽略。
- 文本模式下失败页会汇总到 stderr；`--json` 下检查 `failed_results`。extract 与 crawl 的部分失败退出码仍为 0。
- 默认每条搜索结果打印 600 字符，`--max-chars 0` 打印匹配片段的全文，不是整页。
- URL 一律加引号。读页面用 `extract`，不要用 curl 或 wget。

完整参数见 [cli.md](references/cli.md)；与 `tavily-cli <command> --help` 不一致时以 `--help` 为准。
