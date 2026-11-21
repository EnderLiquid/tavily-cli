/**
 * 与 Tavily API 和 `@tavily/core` 对齐的超时参数，单位为秒。
 *
 * 服务端 `body.timeout` 与客户端 `opts.timeoutSeconds` 是两套独立的时钟。
 * SDK 只把前者当普通字段透传，把后者转成 axios 的 `config.timeout`，不会
 * 从 `body.timeout` 推导。带服务端超时的端点由调用方在服务端上限之外加余量。
 *
 * 这些值来自 API 文档或 SDK 实现，调整时同步核对 docs/reference/tavily-api.md。
 */

/**
 * search 的传输层超时。
 *
 * search 没有服务端 `timeout` 字段，这个值直接作为 axios 的超时时间。
 * `@tavily/core` 对非 research 端点的默认值同为 60 秒；显式写出是为了
 * SDK 默认值变化时仍由这里决定。
 */
export const SEARCH_TIMEOUT_SEC = 60;

/** `/usage` 的传输层超时。该端点只返回用量汇总，不涉及抓取，不需要服务端余量。 */
export const USAGE_TIMEOUT_SEC = 30;

/**
 * 服务端 `body.timeout` 之外追加的客户端余量。
 *
 * 服务端计时只覆盖自身处理阶段，axios 计时从请求发出开始，还包含连接、排队和响应回传。
 * 两者取相同值时，服务端刚完成就可能被客户端中断，因此这里留出固定余量。
 * 这是保守的经验值，不是 API 约定。
 *
 * 只用于 extract、crawl、map。search 没有服务端 `timeout`，其传输超时
 * 由 `SEARCH_TIMEOUT_SEC` 直接给出。
 */
export const SERVER_TIMEOUT_MARGIN_SEC = 10;

/** extract 服务端 `timeout` 的允许范围，来自 API 文档。 */
export const EXTRACT_TIMEOUT_MIN_SEC = 1;
export const EXTRACT_TIMEOUT_MAX_SEC = 60;

/**
 * extract 未指定 `--timeout` 时，用于估算客户端等待上限的服务端默认值。
 *
 * 此时请求体不写 `timeout`，服务端按 `extract_depth` 取默认值：basic 为
 * 10 秒，advanced 为 30 秒。客户端取较大的 30 秒，再叠加传输余量。
 */
export const EXTRACT_TIMEOUT_PLANNING_SEC = 30;

/**
 * crawl、map 服务端 `timeout` 的默认值与允许范围，来自 API 文档。
 *
 * 未指定 `--timeout` 时请求体不写 `timeout`，客户端按这个默认值估算
 * 等待上限，再叠加传输余量。
 */
export const SITE_TIMEOUT_DEFAULT_SEC = 150;
export const SITE_TIMEOUT_MIN_SEC = 10;
export const SITE_TIMEOUT_MAX_SEC = 150;
