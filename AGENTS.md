# tavily-cli

给 agent 使用的 Tavily 检索命令行，内置多账号额度池。命令名 `tavily-cli`，配置目录 `~/.tavily-cli`。

## 技术栈

TypeScript + ESM，Node >= 20.1。参数解析用 `commander`，HTTP 与参数目录用 `@tavily/core`，状态文件锁用 `proper-lockfile`。构建用 tsup，测试用 vitest，格式与 lint 用 biome。

## 常用命令

```bash
npm run build          # 构建到 dist/
npm run dev -- usage   # 直接运行源码
npm test               # 单元测试
npm run check          # lint、类型检查、测试
npm link               # 安装到全局
```

## 架构分层

| 层 | 位置 | 职责 |
|---|---|---|
| 命令 | `src/commands/` | 解析参数、组织请求、渲染输出 |
| 号池 | `src/core/pool.ts` | 选号、预留、结算、故障转移 |
| 校准 | `src/core/sync.ts` | `/usage` 拉取与状态合并 |
| 存储 | `src/core/{config,state}.ts` | 配置文件与状态文件 |
| 外部 | `src/core/client.ts` | 传输层构造 |

## 硬性约束

- stdout 只写数据，诊断写 stderr。
- 状态文件读写必须经过 `state.ts` 的锁事务，网络请求不得在锁内进行。
- 会计字段各有一个写入者，不得在别的路径改写。
- 进程退出前必须 drain 后台任务，失败路径同样执行。
- 文档、注释、提交信息与测试名使用中文。

## 文档

| 文档 | 内容 |
|---|---|
| [总览](docs/overview.md) | 目标、边界、模块划分 |
| [命令面](docs/cli.md) | 命令、选项、输出、退出码 |
| [额度与记账](docs/credit.md) | 计费模型、预估、预留结算、校准 |
| [号池与选号](docs/pool.md) | 配置与状态格式、轮询、故障转移 |
| [Agent skill](docs/skill.md) | 随仓库附带的 skill |
| [工程约定](docs/engineering.md) | 依赖、目录、脚本、测试、分发 |
| [Tavily API 事实](docs/reference/tavily-api.md) | 设计依赖的接口事实 |
