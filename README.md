# tavily-cli

给 agent 用的 Tavily 检索命令行，带多账号额度池。命令名 `tavily-cli`，配置存放在 `~/.tavily-cli`。

```bash
tavily-cli keys add main tvly-YOUR_KEY
tavily-cli usage --sync
tavily-cli search "latest TypeScript release" --depth advanced --max-results 10
```

## 安装

```bash
npm install
npm link
```

`prepare` 会自动构建 `dist/`。重复执行 `npm link` 前先 `npm run build`。

要求 Node.js 20.1 或更高版本。

## 命令

| 命令 | 作用 |
|---|---|
| `search <query>` | 网页搜索 |
| `extract <url...>` | 抽取页面正文 |
| `crawl <url>` | 抓取站点内容 |
| `map <url>` | 发现站点 URL |
| `usage` | 查看号池剩余额度，`--sync` 从 API 刷新 |
| `keys add/list/remove` | 管理 key 池 |

检索命令 `search`、`extract`、`crawl`、`map` 支持 `--json` 与 `-o [file]`，`usage` 与 `keys` 支持 `--json`。

`crawl` 另支持 `--output-dir <dir>`，把每个成功页面保存为 Markdown 文件：

```bash
tavily-cli crawl https://docs.example.com --output-dir .tavily/docs --limit 20
```

`--json` 输出完整响应，`-o` 额外保存完整响应，`--output-dir` 写逐页文件。文本模式下失败页汇总到 stderr，`--json` 下检查 `failed_results`。

## 号池

- 多个账号按配置顺序轮询，余额不足、冷却中、已失效的号自动跳过。
- 每次请求带 `include_usage`，按服务端返回的实际积分记账。
- 每 10 次调用或余额不足时自动校准，校准与业务请求并行。
- 新加入的号需要执行一次 `usage --sync` 才会参与轮询。

## 文档

| 文档 | 内容 |
|---|---|
| [总览](docs/overview.md) | 目标、边界、模块划分 |
| [命令面](docs/cli.md) | 命令、选项、输出、退出码 |
| [额度与记账](docs/credit.md) | 计费模型、预留结算、校准 |
| [号池与选号](docs/pool.md) | 配置与状态格式、轮询、故障转移 |
| [Agent skill](docs/skill.md) | 随仓库附带的 skill |
| [工程约定](docs/engineering.md) | 依赖、目录、脚本、测试 |
| [Tavily API 事实](docs/reference/tavily-api.md) | 设计依赖的接口事实 |

## 许可证

MIT
