# 工程约定

## 包信息

| 项 | 值 |
|---|---|
| 包名 | `@enderliquid/tavily-cli` |
| 命令 | `tavily-cli` |
| 模块格式 | ESM |
| Node | >= 20.1 |
| 许可证 | MIT |

## 依赖

| 类型 | 包 | 用途 |
|---|---|---|
| 运行时 | `commander` | 参数解析 |
| 运行时 | `@tavily/core` | 传输层与参数目录 |
| 运行时 | `proper-lockfile` | 状态文件的跨进程锁 |
| 开发 | `typescript`、`tsup`、`tsx` | 类型、构建与开发运行 |
| 开发 | `vitest` | 测试 |
| 开发 | `@biomejs/biome` | 格式与 lint |

只使用 `@tavily/core` 的 `createTransport` 与 `searchParameters`，不经过高层客户端：请求体需要逐字段控制，响应里的 `usage` 需要原样读取，`/usage` 也不在高层接口覆盖范围内。

## 脚本

| 脚本 | 行为 |
|---|---|
| `build` | tsup 打包到 `dist/` |
| `dev` | tsx 直接运行源码 |
| `test` | vitest run |
| `check` | biome check、tsc --noEmit、vitest |
| `prepare` | 安装依赖后执行 `build`，保证 `npm link` 后运行的是最新产物 |

## 目录

```
src/
├── bin.ts
├── cli.ts
├── commands/{search,extract,site,usage,keys}.ts
├── core/
│   ├── client.ts
│   ├── config.ts
│   ├── cost.ts
│   ├── errors.ts
│   ├── pool.ts
│   ├── queue.ts
│   ├── state.ts
│   └── sync.ts
└── ui/{stream,data,render,artifact,output,report}.ts
tests/
skills/tavily/
```

## 约定

- stdout 只写数据，诊断一律写 stderr。
- 所有状态写入经过 `state.ts` 的加锁事务，网络请求不得在锁内进行。
- 后台任务通过 `queue.ts` 登记，进程退出前统一 `drain`。
- 错误用 `errors.ts` 里的类型区分，命令层只负责映射退出码。
- 请求统一带 `X-Client-Source: tavily-cli-pool`，不发送会话标识。
- 文档与注释使用中文。

## 测试

测试全部基于假传输层与临时 HOME，不访问网络。

| 对象 | 覆盖点 |
|---|---|
| `cost` | 四个命令的预估公式、上界性质、`usage.credits` 提取 |
| `pool` | 轮询顺序、跳过原因、全部跳过路径、预留与余额、故障转移 |
| `sync` | 真值计算、计量延迟、周期翻转、租约、失败记录 |
| `config` | 增删改、重复检测、默认值、key 掩码 |
| `cli` | `--json` 结构、退出码、help、参数错误、错误流路由、`--output-dir` |

状态与配置的并发写入由同一把文件锁串行化，测试用临时目录隔离。

## 分发

开发期用 `npm link` 安装到全局，命令名 `tavily-cli`。发布到 npm 时使用 `@enderliquid` scope，与 npm 上已有的同名包区分。
