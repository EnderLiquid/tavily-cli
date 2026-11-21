---
name: tavily
description: |
  用本地 tavily-cli 完成联网检索：搜索、读取页面、发现站点 URL、抓取站点内容。
  任务需要训练数据之后的事实、新闻、来源或页面正文，或需要核实用户提供的说法时使用。
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

检索时显式用 advanced 深度，一次取 10 条；简单查证可用 basic（advanced 每次 2 分，basic 1 分）：

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
- 某个细节一直查不到时，先弄清它指的角色、事件或术语，再搜那个。
- 写报告时按小节分别检索，先把每节的主要来源 `extract` 出来，再动笔。
- `--include-answer` 的答案只是待核对的摘要，不能当来源。

## extract

```bash
tavily-cli extract 'https://example.com/report' 'https://example.com/summary'
```

- 单次最多 20 个 URL，默认取整页。
- 每次检查 `failed_results`，并在回答里说明哪些页面没读到。
- `basic` 返回空、页面靠 JavaScript 渲染、或内容在表格与结构化数据里时，加 `--extract-depth advanced`（每 5 个成功 URL 2 分，basic 1 分）。
- `--query` 只在长页面里定位一个事实时使用，配合 `--chunks-per-source`；片段在需要的位置被截断时去掉 `--query` 重取。
- 慢页面加 `--timeout 60`。批量失败时只重试失败页，不要整批重跑 advanced。

## map 与 crawl

```bash
tavily-cli map 'https://docs.example.com' --select-paths '/guide/.*' --limit 50
tavily-cli crawl 'https://docs.example.com' --select-paths '/guide/.*' --limit 20 --max-depth 1
tavily-cli crawl 'https://docs.example.com/guide' --output-dir .tavily/guide --limit 20
```

- 只知道站点、不知道页面时，先 map，再 extract 命中的一两个 URL。这比 crawl 整站便宜。
- 站点结构未知时先 map，按返回的真实路径写 crawl 的 `--select-paths`；从 docs 或 blog 子域开始，depth 1，收紧 `--limit`。只有目标页埋得深时才加 `--max-depth`。
- crawl 的成本随页数增长，始终显式设 `--limit`；默认 50 已经不小，从 `--max-depth 1 --limit 20` 起步，每加一层都会放大页数和时间。
- `--instructions` 能按语义聚焦，但积分单价翻倍；先用具体栏目 URL 和 `--select-paths`，路径表达不了意图时再用。
- 结果要进上下文时加 `--chunks-per-source`，不要整页灌入。
- 每次检查 `failed_results`，把失败页用 `extract --extract-depth advanced` 单独重试，并告诉用户哪些页面没读到。
- 只为回答问题时不要用 `--output-dir`；它用于保存站点副本。文本模式下 stdout 输出保存路径，失败页汇总在 stderr。

## 检索质量

- 两个独立来源一致即可停；数独立来源，不数结果条数。
- 回答前把草稿里未确认或凭记忆填的部分补一次定向检索。
- 发布、归属、官方数字、具名机构的决定，回官网或仓库确认；二手站点或生成答案不够。

## 额度

号池在多个账号之间轮换，正常使用时不需要关心。

- 退出码 3 表示额度或鉴权问题，例如没有可用额度、没有可用 key 或 key 失效。运行 `tavily-cli usage` 查看，把结果如实告诉用户。
- 只在遇到退出码 3 时查 `usage`，不要在每次检索前查。
- `usage` 显示没有 key 时，让用户执行 `tavily-cli keys add <label>`，随后 `tavily-cli usage --sync`。新 key 不 sync 不会参与轮询。
- 不要让用户把 key 贴在对话里；让用户自己在终端执行 `tavily-cli keys add <label>`，需要自动化时从 stdin 传入。
- `usage` 显示 `uncalibrated` 时，请用户执行一次 `tavily-cli usage --sync`。

## 输出

- stdout 是本次命令的结果，诊断、保存路径和失败汇总写 stderr。
- 检索命令需要结构化结果时加 `--json`，它会输出完整响应。`--json` 下的错误 JSON 写 stdout。
- 结果很长时用 `-o .tavily/<name>.json` 额外保存完整响应，stdout 不变。首次创建 `.tavily/` 时会写入 `.gitignore`。保存后用 head、grep 或 node 读取需要的部分。
- 要保存站点副本时用 `crawl --output-dir .tavily/<name>`，每个成功页面生成一个 `.md`。`--output-dir` 不写 `.gitignore`，需要时自行确认该目录已被忽略。
- 文本模式下失败页会汇总到 stderr；`--json` 下检查 `failed_results`。extract 与 crawl 的部分失败退出码仍为 0。
- 默认每条搜索结果打印 600 字符，`--max-chars 0` 打印匹配片段的全文，不是整页。
- URL 一律加引号。读页面用 `extract`，不要用 curl 或 wget。

完整参数见 [references/flags.md](references/flags.md)；与 `tavily-cli <command> --help` 不一致时以 `--help` 为准。
