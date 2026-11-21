# 命令面

```
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

| 选项 | 说明 |
|---|---|
| `--json` | 输出 JSON |
| `--retries <n>` | 额度类失败时最多再换几个号，默认取配置项 `retries`（1） |
| `--version` | 打印版本 |
| `-h, --help` | 帮助 |

## search

| 选项 | 说明 |
|---|---|
| `--depth <basic\|advanced\|fast\|ultra-fast>` | 搜索深度，默认 `basic` |
| `--max-results <n>` | 结果数 |
| `--topic <general\|news\|finance>` | 主题 |
| `--time-range <year\|month\|week\|day>` | 时间范围 |
| `--start-date` / `--end-date <YYYY-MM-DD>` | 日期窗口 |
| `--include-domains <csv>` / `--exclude-domains <csv>` | 域名过滤 |
| `--include-answer [basic\|advanced\|true\|false]` | 生成答案 |
| `--include-raw-content [markdown\|text\|false]` | 附带正文 |
| `--max-chars <n>` | 每条结果打印的字符数，默认 600，0 为全部 |
| `-o, --output [file]` | 保存完整响应 |

其余参数由 `@tavily/core` 的 `searchParameters` 目录生成，flag 名为参数名的 kebab-case 形式，语义与 API 一致。`searchDepth` 映射为 `--depth`，`includeAnswer` 与 `includeRawContent` 接受省略值的写法。

## extract

| 选项 | 说明 |
|---|---|
| `--query <text>` | 按相关性重排片段 |
| `--chunks-per-source <1-5>` | 每个来源的片段数，依赖 `--query` |
| `--extract-depth <basic\|advanced>` | 抽取深度 |
| `--format <markdown\|text>` | 输出格式 |
| `--include-images` | 附带图片地址 |
| `--timeout <1-60>` | 服务端等待上限，秒 |
| `-o, --output [file]` | 保存完整响应 |

单次最多 20 个 URL，超出按参数错误处理。

## crawl 与 map

| 选项 | 说明 |
|---|---|
| `--max-depth <1-5>` | 深度，默认 1 |
| `--max-breadth <n>` | 每层链接数，默认 20 |
| `--limit <n>` | 页面或 URL 上限，默认 50 |
| `--instructions <text>` | 自然语言引导 |
| `--select-paths <csv>` / `--exclude-paths <csv>` | 路径正则 |
| `--select-domains <csv>` / `--exclude-domains <csv>` | 域名正则 |
| `--allow-external` / `--no-external` | 是否跟随站外链接 |
| `--timeout <10-150>` | 服务端等待上限，秒 |
| `-o, --output [file]` | 保存完整响应 |
| `--output-dir <dir>` | crawl 专用，逐页保存为 `.md` 文件 |

`crawl` 另有 `--chunks-per-source`、`--extract-depth`、`--format`、`--include-images`。

## usage

| 选项 | 说明 |
|---|---|
| `--sync` | 拉取 `/usage` 并更新状态 |
| `-f, --force` | 与 `--sync` 合用，忽略最小校准间隔 |
| `--key <label>` | 只处理指定的号 |
| `--json` | 输出 JSON |

不带 `--sync` 时只读本地状态，不发起网络请求。`--sync` 被最小间隔挡住的部分在 stderr 说明，退出码仍为 0；`-f` 强制刷新。`--key` 指定的 label 不存在时退出码 2。全部同步请求都失败时退出码 4。

```
LABEL   REMAINING  SYNCED    STATUS
main    831        12s ago   ok
alt-1   120        3m ago    ok
alt-2   0          1h ago    exhausted
alt-3   -          never     uncalibrated
alt-4   -          2d ago    invalid
TOTAL   951
```

`STATUS` 取值：`ok`、`exhausted`、`uncalibrated`、`invalid`、`cooldown`、`disabled`、`unlimited`。`TOTAL` 只累加可用号的已知剩余，跳过失效与停用的号。

## keys

| 命令 | 行为 |
|---|---|
| `keys add <label> [key]` | 添加账号。省略 key 时从 stdin 读第一行。label 重复或 key 已存在时报错 |
| `keys list` | 列出 label、掩码后的 key、是否启用 |
| `keys remove <label>` | 移除账号，同时清理该号的状态记录 |

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

`crawl --output-dir` 的文件名由 URL 的 host、pathname 和 search 生成，非法字符替换为 `_`，Windows 保留设备名加 `_` 前缀，过长名称截断并追加短哈希。同一批内重名按大小写不敏感处理，依次追加 `-2`、`-3`。目录不存在时递归创建，已有同名文件覆盖。没有 `raw_content` 的页面跳过，`failed_results` 不生成文件。

文本模式下失败页汇总写 stderr：

```text
Failed 2 pages:
  https://example.com/a: timeout
  https://example.com/b: 404
```

`--json` 下失败信息只出现在响应的 `failed_results` 中。

| 命令 | 纯文本格式 |
|---|---|
| search | 每条结果三行：`序号. 标题`、URL、片段，条目间空行；有答案时先输出 `Answer: ...` |
| extract | 每页 `# <url>` 加正文；失败项汇总到 stderr |
| crawl | 同 extract；加 `--output-dir` 时 stdout 输出保存路径 |
| map | 每行一个 URL |
| usage | 上表的对齐文本 |

`-o` 把完整响应写入文件；裸 `-o` 落到 `.tavily/<command>-<slug>-<HHMMSS>-<rand>.json`，新建的 `.tavily/` 会附带一行 `*` 的 `.gitignore`。

错误本身只写一个流。文本模式写 stderr；`--json` 写 stdout。此前产生的进度或保存提示仍可能留在 stderr。参数错误同样遵守这个规则，不同时输出帮助和 JSON。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 本地状态异常，例如 `state.json` 无法解析 |
| 2 | 参数或配置错误 |
| 3 | 鉴权或额度问题：全部号不可用、key 无效、401、403、432、433 |
| 4 | API、网络或超时错误 |

`--json` 下错误写 stdout：

```json
{"error": "no key with known remaining; run tavily-cli usage --sync", "code": "quota_exhausted"}
```

额度类错误附带 `details.skips`，记录被跳过的号和原因；`usage --sync` 全部失败时附带 `details.failures`。

`code` 取值：`quota_exhausted`、`key_invalid`、`config_error`、`state_error`、`api_error`、`network_error`、`usage_error`。

## 环境变量

| 变量 | 说明 |
|---|---|
| `TAVILY_CLI_HOME` | 覆盖配置目录，默认为 `~/.tavily-cli`。测试与多套配置隔离时使用 |
