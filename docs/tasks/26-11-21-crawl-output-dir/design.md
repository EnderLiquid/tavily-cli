# crawl 输出目录与统一输出契约

## 状态

已完成，随 `crawl --output-dir` 一并落地。

## 目标

给 `crawl` 增加逐页 Markdown 落盘，同时把分散在命令、渲染层和错误处理里的输出规则收敛成一套契约。

## 输出契约

### 流

| 流 | 内容 |
|---|---|
| stdout | 本次命令的主结果。文本模式放渲染结果，`--json` 放完整 API 响应 |
| stderr | 过程信息。进度、重试、保存路径、跳过原因、部分失败汇总 |
| 退出码 | 只表达整体状态。部分页面失败仍为 0 |

### 模式矩阵

| 参数 | stdout | 文件 |
|---|---|---|
| 无 | 正常文本 | 无 |
| `--json` | 完整 JSON | 无 |
| `-o file` | 不改变 stdout | 完整响应 JSON |
| `--output-dir dir` | crawl 的保存路径，一行一个 | 每个成功页面一个 `.md` |
| `--json -o file` | 完整 JSON | 完整响应 JSON |
| `--json --output-dir dir` | 完整 JSON | 逐页 `.md` |
| `--output-dir dir -o file` | 保存路径 | 逐页 `.md` 与完整响应 |
| 三者同时 | 完整 JSON | 逐页 `.md` 与完整响应 |

`-o` 是附加落盘，不改变 stdout。`--output-dir` 改变 crawl 的文本主结果。

### 错误

- 错误本身只写一个流。文本模式写 stderr；`--json` 写 stdout，结构为 `{error, code, details?}`。
- 此前产生的进度或保存提示仍可能留在 stderr。
- Commander 参数错误遵守同一规则，错误只出现一次，不再追加整页帮助。
- 额度类错误的跳过原因放在 `details.skips`。
- 本地文件写入失败按 `state_error` 处理，退出码 1。

### 部分失败

`failed_results` 是警告，不属于成功主结果。

- 文本模式：成功内容写 stdout，失败块写 stderr。
- `--json`：失败信息只出现在响应的 `failed_results`。
- 退出码保持 0。

## `crawl --output-dir`

- 递归创建目录。
- 只保存 `raw_content` 非空的页面。
- 文件内容为 `# <url>`、空行、正文、换行。
- 文件名由 URL 的 host、pathname（去掉尾部 `/`）和 search 生成，非法字符替换为 `_`，首尾下划线去掉，空值回退为 `index`。
- Windows 保留设备名加 `_` 前缀；末尾的点和空格去掉；超过 120 个字符时截断并追加 8 位哈希。
- 同一批内重名按大小写不敏感比较，依次追加 `-2`、`-3`。
- 目标目录已有同名文件时覆盖。
- `--format text` 仍使用 `.md` 扩展名。
- 保存后 stderr 输出 `Saved N pages to <dir>/`。
- 文本模式 stdout 输出保存路径，一行一个；`--json` 输出完整响应。
- 失败页只汇总到 stderr，不生成失败清单文件。
- 不在输出目录写 `.gitignore`。

## 模块

| 模块 | 职责 |
|---|---|
| `src/ui/stream.ts` | `out`、`err`、`log`、`emitJson` |
| `src/ui/data.ts` | 响应对象的安全读取、控制字符清理 |
| `src/ui/render.ts` | search、pages、map、usage、keys 的文本渲染与失败块 |
| `src/ui/artifact.ts` | 文件名生成、逐页文件写入 |
| `src/ui/output.ts` | `finish`、`-o` 解析与完整响应保存 |
| `src/ui/report.ts` | 致命错误的单一出口 |

命令层构造结果后交给 `finish`，不再直接决定错误和诊断写到哪个流。

## 测试

- `crawl --help` 包含 `--output-dir`。
- 文件生成、重名后缀、无正文跳过、失败页汇总。
- `--json`、`-o` 与 `--output-dir` 的组合。
- 文件名安全处理与 Windows 保留名。
- 参数错误的文本/JSON 单一出口。
- 额度错误的 `details.skips` 与 stderr 不重复。
- `extract` 的失败页从 stdout 移到 stderr。
