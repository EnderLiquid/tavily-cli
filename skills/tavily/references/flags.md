# tavily-cli 参数与退出码

## 全局

| 选项 | 说明 |
|---|---|
| `--json` | 输出 JSON |
| `--retries <n>` | 额度类失败时最多再换几个号，默认取配置值 1 |
| `--version` | 版本 |
| `-h, --help` | 帮助 |

## search

| 选项 | 说明 |
|---|---|
| `--depth <basic\|advanced\|fast\|ultra-fast>` | 默认 basic |
| `--max-results <n>` | 结果数，最大 20 |
| `--topic <general\|news\|finance>` | 主题 |
| `--time-range <year\|month\|week\|day>` | 时间范围，也接受 y、m、w、d |
| `--start-date` / `--end-date <YYYY-MM-DD>` | 日期窗口 |
| `--include-domains <csv>` / `--exclude-domains <csv>` | 域名过滤 |
| `--include-answer [basic\|advanced\|true\|false]` | 生成答案，省略值为 basic |
| `--include-raw-content [markdown\|text\|false]` | 附带正文，省略值为 markdown |
| `--include-images` | 附带图片 |
| `--chunks-per-source <1-3>` | 每个来源的片段数 |
| `--max-chars <n>` | 每条结果打印的字符数，默认 600，0 为全部 |
| `-o, --output [file]` | 保存完整响应，裸 `-o` 写入 `.tavily/` |

其余参数与 Tavily search API 同名，flag 为 kebab-case：`--auto-parameters`、`--max-age-hours`、`--exact-match`、`--safe-search`、`--country`、`--language`、`--filter-by-language`、`--include-favicon`、`--include-published-date`、`--filter-by-published-date`、`--fetch-timeout`、`--cache-fallback`、`--days`、`--include-image-descriptions`、`--include-domains-mode`。

## extract

| 选项 | 说明 |
|---|---|
| `--query <text>` | 按相关性重排片段 |
| `--chunks-per-source <1-5>` | 每页片段数 |
| `--extract-depth <basic\|advanced>` | 抽取深度 |
| `--format <markdown\|text>` | 输出格式 |
| `--include-images` | 附带图片 |
| `--timeout <1-60>` | 服务端等待上限，秒 |
| `-o, --output [file]` | 保存完整响应 |

## crawl

| 选项 | 说明 |
|---|---|
| `--max-depth <1-5>` | 默认 1 |
| `--max-breadth <n>` | 默认 20 |
| `--limit <n>` | 页面上限，默认 50 |
| `--instructions <text>` | 自然语言引导，积分单价翻倍 |
| `--select-paths` / `--exclude-paths <csv>` | 路径正则 |
| `--select-domains` / `--exclude-domains <csv>` | 域名正则 |
| `--allow-external` / `--no-external` | 是否跟随站外链接 |
| `--chunks-per-source <1-5>` | 每页片段数 |
| `--extract-depth <basic\|advanced>` | 抽取深度 |
| `--format <markdown\|text>` | 输出格式 |
| `--include-images` | 附带图片 |
| `--timeout <10-150>` | 服务端等待上限，秒 |
| `-o, --output [file]` | 保存完整响应，不改变 stdout |
| `--output-dir <dir>` | 逐页保存为 `.md` |

## map

| 选项 | 说明 |
|---|---|
| `--max-depth <1-5>` | 默认 1 |
| `--max-breadth <n>` | 默认 20 |
| `--limit <n>` | URL 上限，默认 50 |
| `--instructions <text>` | 自然语言引导，积分单价翻倍 |
| `--select-paths` / `--exclude-paths <csv>` | 路径正则 |
| `--select-domains` / `--exclude-domains <csv>` | 域名正则 |
| `--allow-external` / `--no-external` | 是否跟随站外链接 |
| `--timeout <10-150>` | 服务端等待上限，秒 |
| `-o, --output [file]` | 保存完整响应，不改变 stdout |

`--json` 输出完整响应；`-o` 额外保存完整响应；`--output-dir` 把成功页面写入文件，文本模式下 stdout 输出保存路径。部分失败在文本模式汇总到 stderr，`--json` 下只出现在 `failed_results`。

## usage

| 选项 | 说明 |
|---|---|
| `--sync` | 拉取 `/usage` 更新状态 |
| `-f, --force` | 与 `--sync` 合用，忽略最小间隔 |
| `--key <label>` | 只处理指定的号 |

## keys

```bash
tavily-cli keys add <label> [key]   # 省略 key 时读 stdin 第一行
tavily-cli keys list
tavily-cli keys remove <label>
```

新加入的号需要执行一次 `tavily-cli usage --sync` 才会参与轮询。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 本地状态异常 |
| 2 | 参数或配置错误 |
| 3 | 额度或鉴权问题 |
| 4 | API、网络或超时错误 |

`--json` 下错误写到 stdout：

```json
{"error": "no key with known remaining; run tavily-cli usage --sync", "code": "quota_exhausted"}
```

额度类错误会附带 `details.skips`。参数错误同样遵守单一出口：文本模式写 stderr，`--json` 写 stdout。

`code` 取值：`quota_exhausted`、`key_invalid`、`config_error`、`state_error`、`api_error`、`network_error`、`usage_error`。
