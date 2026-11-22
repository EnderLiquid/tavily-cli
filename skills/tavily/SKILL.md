---
name: tavily
description: 用本地 tavily-cli 搜索网页、读取正文、发现站内链接和抓取多页内容。需要查最新信息、核实事实、找可引用的来源或读取指定网页时使用。
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

一般检索显式用 `--depth advanced`，最多请求 10 条结果；简单查证可用 `--depth basic`：

```bash
tavily-cli search 'Rust 2024 edition release notes' --depth advanced --max-results 10
```

- 查询写成搜索引擎能匹配的短语，不要照搬用户的整句话。
- 有多个待核实要点时，按要点拆分查询。独立查询可并行，每次 Bash 调用只运行一条检索命令。
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

- 单次最多 20 个 URL，默认抽取页面正文。
- `basic` 抽不到正文时，或遇到 JavaScript 渲染的页面、表格等结构化内容时，尝试 `--extract-depth advanced`。
- 在长页面里定位具体事实时，用 `--query` 配合 `--chunks-per-source` 取相关片段。片段没覆盖所需内容时，去掉这两个选项重取正文。
- 批量抽取时只重试失败页；页面超时可加 `--timeout 60`。

## map 与 crawl

```bash
tavily-cli map 'https://docs.example.com' --select-paths '/guide/.*' --limit 50
tavily-cli crawl 'https://docs.example.com' --select-paths '/guide/.*' --limit 20 --max-depth 1
tavily-cli crawl 'https://docs.example.com/guide' --output-dir .tavily/guide --limit 20
```

- 只需要一两个页面、但不知道 URL 时，先用 `map` 找页面，再用 `extract` 读正文。
- 抓取多页时，从最具体的栏目 URL 开始，例如 docs 或 blog 子域下的目标栏目。站点结构未知时，先用 `map` 查找页面，再按返回的路径编写 `--select-paths` 正则。
- `crawl` 始终显式设 `--limit`。从 `--max-depth 1 --limit 20` 起步，目标页在更深层时再调大 `--max-depth`。
- 需要按语义聚焦或只需把相关片段放进上下文时，用 `--instructions` 指定关注内容；配合 `--chunks-per-source` 控制每页的片段数。
- 失败页单独用 `extract --extract-depth advanced` 重试。

## 检索质量

- 一般事实有两个独立来源互相印证即可结束查证；同一原文的转载算一个来源。
- 发布、归属、官方数字和机构决定，应查官网、公告或仓库等一手资料。
- 回答前对存疑的要点做一次定向检索；仍查不到依据时，说明哪些内容尚未核实。

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

- stdout 输出主结果；进度、重试提示和 `-o` 的保存提示写 stderr。
- 检索命令加 `--json` 后，stdout 输出完整 API 响应；出错时输出错误 JSON。
- `extract` 和 `crawl` 即使有失败页也可能以 0 退出。文本模式看 stderr 的失败汇总，`--json` 模式检查 `failed_results`。重试后仍未读到的页面，在回答中说明。
- 用 `-o .tavily/<name>.json` 额外保存完整响应，stdout 不变。`-o` 创建 `.tavily/` 时会写入 `.tavily/.gitignore`。
- 保存站点副本时用 `crawl --output-dir .tavily/<name>`，每个有正文的成功页面保存为一个 `.md`。文本模式下 stdout 逐行输出保存路径。按需将保存目录加入 Git 忽略规则。
- 要控制上下文长度，先缩小请求范围，或将 stdout 重定向到文件后按需读取。
- `search` 的文本模式默认将每条结果的片段截到 600 字符，标题和 URL 照常输出；`--max-chars 0` 输出完整片段。
- URL 一律加引号。读页面用 `extract`，不要用 curl 或 wget。

完整参数见 [cli.md](references/cli.md)；与 `tavily-cli <command> --help` 不一致时以 `--help` 为准。
