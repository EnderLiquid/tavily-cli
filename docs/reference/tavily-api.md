# Tavily API 事实

以下是设计所依赖的接口事实，来源为官方文档与实测，核对日期 2026-11-22。

## 基础

| 项 | 值 |
|---|---|
| 地址 | `https://api.tavily.com` |
| 鉴权 | `Authorization: Bearer <API_KEY>` |
| 请求体 | JSON |
| 相关端点 | `POST /search`、`POST /extract`、`POST /crawl`、`POST /map`、`GET /usage` |

## include_usage

四个检索端点都接受 `include_usage: true`，响应里多出 `usage.credits`，表示本次请求实际扣减的积分。文档未把它列为计费项。extract、map、crawl 按批次计费，未满一批时该值为 0。

## GET /usage

返回单个 key 与所属账号在当前计费周期的用量。

```json
{
  "key": {
    "usage": 169, "limit": null,
    "search_usage": 163, "extract_usage": 6,
    "crawl_usage": 0, "map_usage": 0, "research_usage": 0
  },
  "account": {
    "current_plan": "Researcher",
    "plan_usage": 169, "plan_limit": 1000,
    "search_usage": 163, "extract_usage": 6,
    "crawl_usage": 0, "map_usage": 0, "research_usage": 0,
    "paygo_usage": 0, "paygo_limit": null
  }
}
```

| 字段 | 语义 |
|---|---|
| `key.usage` / `key.limit` | 单个 key 的用量与限额。`limit` 为 `null` 表示该 key 未单独设限 |
| `account.plan_usage` / `account.plan_limit` | 账号在当前套餐下的用量与总额度，免费账号为 1000 |
| `current_plan` | 套餐名称，本项目不使用 |
| `paygo_*` | 按量付费的用量与上限，本项目不使用 |

免费账号实测 `key.limit` 为 `null`，真实上限在 `account.plan_limit`，因此剩余额度需要按两者取小计算。

`plan_usage` 不保证实时。实测中，连续消耗积分后数分钟内它仍保持原值，而单次响应的 `usage.credits` 已经正常返回。依赖它做额度判定时，需要容忍这段延迟。

## 积分

| 端点 | 消耗 |
|---|---|
| search basic、fast、ultra-fast | 每次 1 |
| search advanced | 每次 2 |
| extract basic | 每 5 个成功 URL 1 |
| extract advanced | 每 5 个成功 URL 2 |
| map | 每 10 个页面 1，带 `instructions` 时每 10 个页面 2 |
| crawl | map 与 extract 之和 |
| research mini / pro | 每次 4 到 110 / 15 到 250 |

`auto_parameters` 可能在调用方未指定深度时把 `search_depth` 提升到 advanced，从而变成 2 分。

## 限流

| 范围 | 额度 |
|---|---|
| 账号整体（Researcher 计划） | 100 请求每分钟 |
| `/crawl` | 100 请求每分钟 |
| `/map` | 100 请求每分钟 |
| `/usage` | 10 请求每 10 分钟 |

限流按组织或账号计，同一账号下的多个 key 共享额度。实测 429 分两类，均带 `Retry-After`，值为秒：应用层限流给出具体秒数，错误文本重复该值；网关拦截返回 60 秒，实际封锁可能更久。

## 状态码

| 码 | 含义 |
|---|---|
| 401 | key 缺失或无效 |
| 403 | 拒绝访问，可能是风控 |
| 429 | 超出请求频率限制 |
| 432 | key 限额或套餐额度超限 |
| 433 | 按量付费上限超限 |
| 434 | flex 容量不足，稍后重试或改用缓存 |

错误体形如 `{"detail": {"error": "..."}}`。

## SDK

`@tavily/core` 1.1.0，Node >= 20.1，基于 axios。

| 导出 | 用途 |
|---|---|
| `createTransport(options)` | 返回 `post`、`get`、`stream`，直接对应 REST 端点 |
| `searchParameters` | search 的参数目录，含类型、取值范围与说明 |
| `TavilyRequestError` | 带 `status` 与 `body`，用于分类故障 |

`TavilyRequestError` 只保留 `status` 与 `body`，不暴露响应头，因此拿不到 `Retry-After`。`TavilyKeylessLimitError.retryAfter` 取自 keyless 响应体的 `retry_after_seconds`，与请求头无关。

传输层支持 `apiKey`、`apiBaseURL`、`clientSource`、`timeoutSeconds`，以及代理环境变量。`createTransport` 不做自动重试。
