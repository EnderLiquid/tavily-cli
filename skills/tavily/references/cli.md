# tavily-cli 命令参考

本文件是命令、参数、输出契约与退出码的完整参考。

## 命令

```text
tavily-cli
├── search <query>
├── extract <url...>
├── crawl <url>
├── map <url>
├── usage
└── keys
    ├── add <label> [key]
    ├── list
    └── remove <label>
```

## 全局选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `--json` | 关闭 | 输出 JSON。检索命令输出完整 API 响应，`usage` 与 `keys` 输出自定义结构；错误 JSON 写 stdout。 |
| `--retries <n>` | 配置值 1 | 额度类失败时最多再换几个号。 |
| `--version` | 无 | 打印版本。 |
| `-h, --help` | 无 | 打印帮助。 |

## search

```bash
tavily-cli search 'Rust 2024 edition release notes' --depth advanced --max-results 10
```

| 选项 | 默认 | 说明 |
|---|---|---|
| `--depth <basic\|advanced\|fast\|ultra-fast>` | basic | 搜索深度。advanced 覆盖更深，每次 2 分；basic、fast、ultra-fast 每次 1 分。 |
| `--max-results <n>` | 10 | 结果数，0 到 20。 |
| `--topic <general\|news\|finance>` | general | 搜索类别。news 适合实时新闻，finance 适合金融内容。 |
| `--time-range <year\|month\|week\|day\|y\|m\|w\|d>` | 不设 | 按发布日期回看。持续更新的页面可能被过滤，改用 `--max-age-hours`。 |
| `--start-date <YYYY-MM-DD>` / `--end-date <YYYY-MM-DD>` | 不设 | 按发布日期限制窗口。 |
| `--days <n>` | 未公开 | 未公开参数，作用未知。 |
| `--max-age-hours <n>` | 不设 | 缓存副本最大年龄，小时。`0` 总是实时抓取，`-1` 从不实时抓取，`1` 到 `720` 限制缓存年龄。适合天气、价格等持续更新页面。 |
| `--include-domains <csv>` / `--exclude-domains <csv>` | 空 | 域名过滤，逗号分隔；include 最多 300 个，exclude 最多 150 个。 |
| `--include-domains-mode <restrict\|prefer>` | restrict | 需要配合 `--include-domains`。restrict 只返回所列域名，prefer 保留全网结果并提升所列域名。 |
| `--include-answer [basic\|advanced\|true\|false]` | false | 生成答案。basic 或 true 返回快速答案，advanced 返回更详细的答案。答案只作摘要，不能当来源。 |
| `--include-raw-content [markdown\|text\|false]` | false | 附带清理后的正文。text 可能增加延迟。 |
| `--include-images` | 关闭 | 附带查询相关图片和每条结果的图片列表。 |
| `--include-image-descriptions` | 关闭 | 需要配合 `--include-images`，为每张图片附加描述。 |
| `--include-favicon` | 关闭 | 每条结果附带 favicon URL。 |
| `--chunks-per-source <1-3>` | 3 | 每个来源返回的片段数，控制 `content` 长度；适用于 basic、fast、advanced。 |
| `--country <country>` | 不设 | 提升指定国家的结果，仅 `--topic general` 可用；使用国家英文名。 |
| `--language <language>` | 不设 | 提升指定语言的结果，接受 ISO 639-1 代码或英文语言名；query 最好使用同一种语言。 |
| `--filter-by-language` | 关闭 | 严格过滤非指定语言的结果；需要配合 `--language`，否则返回 400。 |
| `--safe-search` | 关闭 | 过滤成人或 unsafe 内容；fast 与 ultra-fast 深度不支持。 |
| `--include-published-date` | 关闭 | 结果附带 `published_date`；news 主题自动开启；无法识别的日期为 null；该功能仍在 beta。 |
| `--filter-by-published-date` | 关闭 | 移除时间窗口外和无法识别发布日期的结果，同时开启 `--include-published-date`。 |
| `--auto-parameters` | 关闭 | 由 Tavily 根据 query 自动选择参数，显式值会覆盖自动值；可能把 depth 提到 advanced，按 2 分计费。include-answer、include-raw-content 与 max-results 仍需手动设置。 |
| `--exact-match` | 关闭 | 只返回包含引号内精确短语的结果，忽略同义词和语义变体。查询里用引号包住目标短语。 |
| `--fetch-timeout <n>` | 未公开 | 未公开参数，作用未知。 |
| `--cache-fallback` | 未公开 | 未公开参数，作用未知。 |
| `--max-chars <n>` | 600 | 文本模式下每条结果打印的字符数；0 打印匹配片段的全文，不是整页。 |
| `-o, --output [file]` | 不设 | 额外保存完整响应，不改变 stdout。裸 `-o` 落到 `.tavily/`。 |

`--days`、`--fetch-timeout`、`--cache-fallback` 由 `@tavily/core` 透传，公开 API 参考没有独立说明，不要依赖其行为。

## extract

```bash
tavily-cli extract 'https://example.com/report' 'https://example.com/summary'
```

| 选项 | 默认 | 说明 |
|---|---|---|
| `--query <text>` | 不设 | 按相关性重排抽取出的片段。 |
| `--chunks-per-source <1-5>` | 3 | 每个来源返回的片段数，约 800 字符一段；需要配合 `--query`，用于控制 `raw_content` 长度。 |
| `--extract-depth <basic\|advanced>` | basic | advanced 会抽取表格和嵌入内容，成功率更高；basic 每 5 个成功 URL 1 分，advanced 2 分。 |
| `--format <markdown\|text>` | markdown | 正文格式。text 可能增加延迟。 |
| `--include-images` | 关闭 | 附带从页面抽取的图片列表。 |
| `--timeout <1-60>` | 不设 | 服务端等待上限，秒。不传时 basic 10 秒，advanced 30 秒。 |
| `-o, --output [file]` | 不设 | 额外保存完整响应，不改变 stdout。 |

单次最多 20 个 URL，超出按参数错误处理。`failed_results` 表示部分页面失败，退出码仍为 0。

## crawl

```bash
tavily-cli crawl 'https://docs.example.com' --select-paths '/guide/.*' --limit 20 --max-depth 1
```

| 选项 | 默认 | 说明 |
|---|---|---|
| `--max-depth <1-5>` | 1 | 从起始 URL 向外探索的层数。 |
| `--max-breadth <n>` | 20 | 每层最多跟随的链接数，最小 1，API 上限 500。 |
| `--limit <n>` | 50 | 本次最多处理的链接数，最小 1，没有上限。 |
| `--instructions <text>` | 不设 | 自然语言引导。设置后 mapping 成本从每 10 页 1 分提高到 2 分。 |
| `--select-paths <csv>` / `--exclude-paths <csv>` | 空 | 路径正则，逗号分隔，例如 `/docs/.*`、`/private/.*`。 |
| `--select-domains <csv>` / `--exclude-domains <csv>` | 空 | 域名正则，逗号分隔，例如 `^docs\.example\.com$`。 |
| `--allow-external` / `--no-external` | 允许 | 是否把站外链接放进结果，默认允许。 |
| `--chunks-per-source <1-5>` | 3 | 每页返回的片段数，约 800 字符一段；需要配合 `--instructions`。 |
| `--extract-depth <basic\|advanced>` | basic | advanced 抽取表格和嵌入内容；basic 每 5 个成功页面 1 分，advanced 2 分。 |
| `--format <markdown\|text>` | markdown | 正文格式。text 可能增加延迟。 |
| `--include-images` | 关闭 | 附带图片列表。 |
| `--timeout <10-150>` | 150 | 服务端等待上限，秒。 |
| `-o, --output [file]` | 不设 | 额外保存完整响应，不改变 stdout。 |
| `--output-dir <dir>` | 不设 | 每个有正文的成功页面保存为一个 `.md` 文件；不写 `.gitignore`。 |

crawl 的成本由 map 与 extract 两部分组成，`--limit` 只限制页数。部分页面失败时退出码仍为 0。

## map

```bash
tavily-cli map 'https://docs.example.com' --select-paths '/guide/.*' --limit 50
```

| 选项 | 默认 | 说明 |
|---|---|---|
| `--max-depth <1-5>` | 1 | 从起始 URL 向外探索的层数。 |
| `--max-breadth <n>` | 20 | 每层最多跟随的链接数，最小 1，API 上限 500。 |
| `--limit <n>` | 50 | 本次最多处理的链接数，最小 1，没有上限。 |
| `--instructions <text>` | 不设 | 自然语言引导。设置后成本从每 10 页 1 分提高到 2 分。 |
| `--select-paths <csv>` / `--exclude-paths <csv>` | 空 | 路径正则，逗号分隔。 |
| `--select-domains <csv>` / `--exclude-domains <csv>` | 空 | 域名正则，逗号分隔。 |
| `--allow-external` / `--no-external` | 允许 | 是否把站外链接放进结果，默认允许。 |
| `--timeout <10-150>` | 150 | 服务端等待上限，秒。 |
| `-o, --output [file]` | 不设 | 额外保存完整响应，不改变 stdout。 |

map 只返回 URL，不读取页面正文。

## usage

| 选项 | 默认 | 说明 |
|---|---|---|
| `--sync` | 关闭 | 拉取 `/usage` 并更新状态。 |
| `-f, --force` | 关闭 | 与 `--sync` 合用，忽略最小同步间隔。 |
| `--key <label>` | 不设 | 只同步指定的号。 |

不带 `--sync` 时只读本地状态。被最小间隔挡住的同步在 stderr 说明，退出码仍为 0；全部同步请求失败时退出码 4；`--key` 指定的 label 不存在时退出码 2。

`STATUS` 取值：`ok`、`exhausted`、`uncalibrated`、`invalid`、`cooldown`、`disabled`、`unlimited`。`TOTAL` 只累加可用号的已知剩余。

## keys

| 命令 | 行为 |
|---|---|
| `keys add <label> [key]` | 添加账号。省略 key 时从 stdin 读第一行。label 重复或 key 已存在时报错。 |
| `keys list` | 列出 label、掩码后的 key、是否启用。 |
| `keys remove <label>` | 移除账号，同时清理该号的状态记录。 |

key 只在 `keys list` 中以 `tvly-…` 加末四位的掩码形式出现。`add` 与 `remove` 的确认信息写 stderr；加 `--json` 时向 stdout 输出 `{"label":"main","ok":true}`。

新加入的号没有校准记录，需要执行一次 `usage --sync` 才会参与轮询。

## 输出

stdout 只承载本次命令的主结果，stderr 承载进度、保存路径、重试、跳过原因和部分失败汇总。

| 选项 | 主结果 | 落盘 |
|---|---|---|
| 默认 | 文本渲染 | 无 |
| `--json` | 完整 API 响应 | 无 |
| `-o [file]` | 不改变 stdout | 完整响应 JSON |
| `--output-dir <dir>` | crawl 的文本结果改为保存路径，一行一个 | 每个成功页面一个 `.md` |

`--json` 与 `-o` 可以同时使用，此时 JSON 同时写 stdout 和文件。`--output-dir` 可与 `-o` 同时使用，完整响应仍写入 `-o` 指定的文件。`usage` 与 `keys list` 的 `--json` 输出自定义结构，不是 API 原始响应。

裸 `-o` 落到 `.tavily/<command>-<slug>-<HHMMSS>-<rand>.json`；首次创建 `.tavily/` 时会写入一行 `*` 的 `.gitignore`。`crawl --output-dir` 不写 `.gitignore`。

`crawl --output-dir` 的文件名由 URL 的 host、pathname 和 search 生成，非法字符替换为 `_`，Windows 保留设备名加 `_` 前缀，过长名称截断并追加短哈希。同一批内重名按大小写不敏感处理，依次追加 `-2`、`-3`。目录不存在时递归创建，已有同名文件覆盖。没有 `raw_content` 的页面跳过，`failed_results` 不生成文件。

文本模式下失败页汇总写 stderr：

```text
Failed 2 pages:
  https://example.com/a: timeout
  https://example.com/b: 404
```

`--json` 下失败信息只出现在响应的 `failed_results` 中。extract 与 crawl 的部分失败退出码仍为 0。

| 命令 | 纯文本格式 |
|---|---|
| search | 每条结果三行：`序号. 标题`、URL、片段，条目间空行；有答案时先输出 `Answer: ...` |
| extract | 每页 `# <url>` 加正文；失败项汇总到 stderr |
| crawl | 同 extract；加 `--output-dir` 时 stdout 输出保存路径 |
| map | 每行一个 URL |
| usage | 对齐文本 |

错误本身只写一个流。文本模式写 stderr；`--json` 写 stdout。此前产生的进度或保存提示仍可能留在 stderr。参数错误同样遵守这个规则，不同时输出帮助和 JSON。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功；extract、crawl 部分页面失败仍为 0 |
| 1 | 本地状态异常，例如 `state.json` 无法解析 |
| 2 | 参数或配置错误 |
| 3 | 鉴权或额度问题：全部号不可用、key 无效、401、403、432、433 |
| 4 | API、网络或超时错误，包括 434 |

`--json` 下错误写 stdout：

```json
{"error": "no key with known remaining; run tavily-cli usage --sync", "code": "quota_exhausted"}
```

额度类错误附带 `details.skips`，记录被跳过的号和原因；`usage --sync` 全部失败时附带 `details.failures`。

`code` 取值：`quota_exhausted`、`key_invalid`、`config_error`、`state_error`、`api_error`、`network_error`、`usage_error`。

## 环境变量

| 变量 | 说明 |
|---|---|
| `TAVILY_CLI_HOME` | 覆盖配置目录，默认为 `~/.tavily-cli`。测试与多套配置隔离时使用。 |
