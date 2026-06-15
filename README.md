# DOH-ECH – Cloudflare Pages 实现 DoH with ECH 直连CF托管站点

基于 Cloudflare Pages 的单文件 **DNS-over-HTTPS (DoH) 服务器**，智能为 Cloudflare / Meta 站点注入 ECH 配置，实现隐藏SNI，并支持自定义优选 IP、多域名解析与全球边缘缓存,实现通过优选ip后，直连CF托管网站/Meta 站点 如X，Facebook等 。

---

## 部署步骤

### 1. 准备 CIDR 列表/已列出
编辑 `_worker.js`，找到 `RAW_META_CIDRS` 和 `RAW_CF_CIDRS` 数组，将您的完整 CIDR 列表填入（若不需要归属探测可保留空数组）。  
**Cloudflare IPv4 官方列表**：[https://www.cloudflare.com/ips-v4](https://www.cloudflare.com/ips-v4)

### 2. 部署到 Cloudflare Pages
- 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Pages** → **创建项目**。
- 上传资产或连接 Git 仓库，上传 `_worker.js` 至项目根目录。
- 无需设置构建命令或输出目录（Pages 会自动识别单文件 Worker）。
- 部署完成后访问分配的域名即可。

### 3. 使用方法
- **网页查询**：直接访问首页（`/`），输入域名、选择类型，可展开高级选项填入自定义参数后查询。
- **DOH地址(完整参数示例)**：  
  ```
   "https://your-domain.pages.dev/ech?best=true&clientip=1.2.4.8&cf=ip.sb&ip4=1.2.3.4,5.6.7.8&ip6=::&meta=fbcdn.net&MetaIp4=5.6.7.8&MetaIp6=::"
  ```
- **配置 DoH 客户端**：  
  -- 将支持ECH的浏览器如Chrome/Firefox 的安全DNS设置为 DoH 地址设置：`https://你的域名/ech`，并可通过请求头或 URL 参数传递自定义 IP。
  
  -- 使用代理工具：将需要直连的CF站点的域名解析服务器doh设置为`https://你的域名/ech`，并可通过请求头或 URL 参数传递自定义 IP。
  
---
## 特性

- ✅ **DoH 服务**  
  提供 `/ech`（注入 ECH）和 `/doh`（纯净转发）两个标准 DoH 端点，支持 GET/POST。
- ✅ **ECH 自动注入**  
  - 对 **Cloudflare** 托管域名自动获取真实 ECH 配置。  
  - 对 **Meta**（Facebook 等）域名注入固定 ECH 配置。  
  - 支持通过 `ech` 参数自定义 ECH 获取配置的来源域名。
- ✅ **固定域名优选**  
  内置 Cloudflare / Meta 自定义固定域名列表，直接返回预设的优选 IP（可自定义覆盖）。
- ✅ **自定义 IP 替换**  
  通过 `ip4`、`ip6`、`metaIp4`、`metaIp6` 参数强制替换解析结果，支持逗号分隔或 JSON 数组。
- ✅ **cf 优选多域名解析**  
  `cf` 参数支持逗号分隔的多个域名，并发解析并合并去重 IP，适用于多 CDN 负载均衡。
- ✅ **双上游竞速**  
  同时查询 Google DNS 和阿里云 DNS，取最快响应，提高解析速度。
- ✅ **全球边缘缓存**  
  利用 Cloudflare Cache API 缓存上游 DNS 结果（A/AAAA 300s，HTTPS 600s），大幅减少上游请求次数。
- ✅ **CIDR 归属探测**  
  自动识别未知域名的 Cloudflare / Meta 归属，并注入对应 ECH（需配置 CIDR 列表）。
- ✅ **美观的前端查询页面**  
  内嵌网页界面，支持手动输入域名、选择记录类型、高级参数设置，即时显示 JSON 结果。

---

## 路由说明

| 路径          | 说明                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `/`           | 前端查询页面，提供域名输入、类型选择与高级选项。                      |
| `/api/query`  | JSON API，通过 URL 参数查询并返回结构化结果（支持所有自定义参数）。    |
| `/ech`        | DoH 端点，返回注入 ECH 配置的 DNS 响应（支持参数与请求头）。          |
| `/doh`        | DoH 端点，纯净上游转发，不注入 ECH。  |
---

## 自定义参数

所有参数均可通过 **URL 查询字符串** 或 **HTTP 请求头** 传入（DoH 端点同时支持请求头 `X-Ip4` 等）。

| 参数名        | 用途                                                                                     | 示例值                              |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| `ip4`         | Cloudflare / 所有域名的 IPv4 替换地址（逗号分隔多 IP）                                    | `1.2.3.4,5.6.7.8`                  |
| `ip6`         | Cloudflare / 所有域名的 IPv6 替换地址                                                     | `::1,::2`                           |
| `metaIp4`     | Meta 域名的 IPv4 替换地址                                                                 | `157.240.1.1`                       |
| `metaIp6`     | Meta 域名的 IPv6 替换地址                                                                 | `2a03:2880:...`                     |
| `cf`          | 解析优选域名（支持逗号分隔多域名）以获取替换 IP，**仅对 Cloudflare 相关域名生效**        | `example.com,ip2.example.com`       |
| `meta`          | 解析优选域名（支持逗号分隔多域名）以获取替换 IP，**仅对 Meta相关域名生效**        | `example.com,ip2.example.com`       |
| `ech`         | 获取CF公共ECH配置的域名（默认 `cloudflare-ech.com`）                                      | `cloudflare-ech.com`               |
| `best` | `X-Best` | 全局跟随优选（`true`/`false`） | `true` |
| `clintip` | `X-ClientIp` | 全局跟随优选（`/24`/``） | `::/26` |

> **注意**：`cf` 参数仅当目标域名为 Cloudflare 站点（静态列表匹配或 CIDR 探测）时才会生效，避免误替换非 CF 域名。

---
## 📡 API 示例

### JSON API

```bash
# 基础查询
curl "https://your-domain.pages.dev/api/query?domain=twitter.com&type=A"

# 携带参数
curl "https://your-domain.pages.dev/api/query?domain=twitter.com&type=A&ip4=1.2.3.4&cf=backup.com"
```

**返回示例：**

```json
{
  "domain": "twitter.com",
  "type": "A",
  "answers": ["104.18.10.118"],
  "ech": null
}
```

### DoH GET 请求

```bash
# 基础查询
curl "https://your-domain.pages.dev/ech?dns=AAABAAABAAAAAAAAA3d3dwdleGFtcGxlA2NvbQAAAQAB"

# 携带参数
curl "https://your-domain.pages.dev/ech?dns=AAABAAAB...&ip4=1.2.3.4&cf=example.com"
```

### DoH POST 请求

```bash
# 通过请求头传参
curl -X POST "https://your-domain.pages.dev/ech" \
  --data-binary @dns-query.bin \
  -H "Content-Type: application/dns-message" \
  -H "X-Ip4: 1.2.3.4,5.6.7.8" \
  -H "X-MetaIp4: 157.240.1.1" \
  -H "X-CF: example.com,example2.com"

# 通过 URL 参数传参
curl -X POST "https://your-domain.pages.dev/ech?ip4=1.2.3.4" \
  --data-binary @dns-query.bin \
  -H "Content-Type: application/dns-message"
```

### 特殊查询

```bash
# 获取 Cloudflare ECH
curl "https://your-domain.pages.dev/api/query?domain=cf.ech&type=HTTPS"

# 获取 Meta ECH
curl "https://your-domain.pages.dev/api/query?domain=fb.ech&type=HTTPS"
```

## 📝 多 IP 格式

- 逗号分隔：`ip4=1.2.3.4,5.6.7.8`
- JSON 数组（仅请求头）：`X-Ip4: ["1.2.3.4","5.6.7.8"]`
## 注意事项

- **CIDR 列表**：如需自动识别 CF/Meta 站点并注入 ECH，请替换完整 CIDR；不替换则只依赖静态域名列表。
- **子请求上限**：免费计划每日 10 万次子请求，已通过边缘缓存大幅降低使用量，正常个人使用一般不会超出。
- **ECH 有效性**：Meta 的 ECH 为固定配置（可能会过期），Cloudflare 的 ECH 从指定域名动态获取，可自定义 `ech` 参数。
- **隐私与安全**：上游查询使用 Google 和阿里云的公共 DNS JSON API，注意数据隐私（可自行替换为其他 DoH 服务）。

---

## 项目结构

```
/
└── _worker.js           # 单文件，包含前端页面、API、DoH 全部逻辑
```

---

## 技术栈

- Cloudflare Pages（边缘函数运行时）
- 标准 DNS 二进制报文构造与解析
- Google DNS / 阿里云 DNS JSON API
- Cloudflare Cache API（边缘缓存）
- Promise.any 双上游竞速

---

## 协议

本项目由AI生成，仅供娱乐目的，请遵守当地法律法规合理使用

---

