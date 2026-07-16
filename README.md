# DOH-ECH ：私人DOH服务器+HTTPS RR控制器 + ECH注入器

 **个人 DNS-over-HTTPS (DoH) 服务器**:
 
 **1.基于ECH拓展**： 
     智能为 Cloudflare / Meta 站点HTTPS RR 注入 ECH 配置
     
 **2.利用QUIC Client Initial 分片** 
     Chrome/Firefox以及代理客户端等多已支持，为支持quic协议的网站返回alpn=h3，为指定站点返回alpn:h3,仅ipv6hints的HTTPS记录并屏蔽A记录等
     
---
## 警告
本项目由AI生成，仅供娱乐目的， **不得用于非法用途，请遵守当地法律法规合理学习和使用**，用于违反当地法律法规的非法用途造成的后果与本人本项目无关！

---

## 路由说明

| 路径          | 说明                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `/`           | 前端测试查询页面，提供域名输入、类型选择与高级选项。                      |
| `/api/query`  | JSON API，通过 URL 参数查询并返回结构化结果（支持所有自定义参数）。    |
| `/ech`        | DoH 端点，返回注入 ECH 配置/增强构造的HTTPS RR（支持参数与请求头）。          |
| `/doh`        | DoH 端点，纯净上游转发，不作任何修改  |
| `/log`           | 日志系统。  
---
## Enhance Mode 功能与使用
增强模式是 DoH-ECH 的一项高级功能，允许您为网站主动注入连接优化参数，例如强制 QUIC (HTTP/3)、提供自定义 IP 提示 (IP hints) 以及精确屏蔽 A/AAAA 记录。这不仅能加速网站访问，还能解决某些浏览器因协议偏好导致的连接失败问题。

> **注意**：增强模式规则**不会影响**静态列表中的 Cloudflare/Meta 域名，这些站点的 ECH 注入和优选 IP 逻辑独立运行，仅在规则列表里**特意添加CF/Meta域名规则**时才会生效(优先级:`ips[不为空]`>`cf/meta优选结果`>`ips[空]`)。

### 模式状态
增强模式通过 `enhance` 参数控制，共有三种状态：

| 状态 | 值 | 行为 |
|------|----|------|
| **关闭** | `off` (默认) | 不进行任何增强，普通域名保持上游原始记录。 |
| **规则模式** | `rule` | 仅对匹配**规则**的域名生效，未匹配域名保持原样。 |
| **全局模式** | `full` | 对所有普通域名生效。规则匹配的域名优先使用规则 IP，未匹配的从上游获取。 |

### 增强内容
开启增强模式后，匹配到的域名将获得以下优化：

**自定义 SVC_PARAM**
- **ALPN 强制**：HTTPS 记录中注入 `alpn="h3,h2"`，引导浏览器优先使用 QUIC (HTTP/3)，失败时可回退 HTTP/2。可通过 `alpn` 参数自定义（如 `h3` 仅 QUIC）。
- **mandatory 指定**：指定哪些 HTTPS 参数必须被客户端理解，否则客户端应忽略整条 HTTPS 记录
- **no-default-alpn** 
- **IP Hints 注入**：HTTPS 记录中添加 `ipv4hint` 和/或 `ipv6hint`，浏览器可直接尝试这些 IP 建立连接，跳过 A/AAAA 查询。
  
**自定义规则**  
- **A/AAAA 记录屏蔽**：可通过规则标志 `noA` 或 `noAAAA` 完全屏蔽对应类型的 DNS 查询，强制浏览器依赖 hints 或仅使用特定 IP 版本。
-  **读取自定义远程hosts**

### 规则格式
增强模式的核心是**规则**，用于精确指定需要优化的域名及其参数。
#### 内置增强规则模板 (BUILTIN_HINTS)
此文档为 `_worker.js` 中 `BUILTIN_HINTS` 常量的配置指南。所有规则均支持通配符 `*`，且可配置 `noA` / `noAAAA` 标志及 IP 列表或 IPv6 前缀。

```javascript
const BUILTIN_HINTS = {

    // 写法一：对象形式，支持屏蔽标志和 IP 列表
    {
        domains:["*.domain1.com","domain2.com"],
        ips: ["1.2.3.4", "2001:db8::/32"],  // 可使用 IPv6 前缀（/32 等）
        noA: true,                          // 屏蔽 A 记录（仅 IPv6）
        noAAAA: false                       // 允许 AAAA 记录
    }
    //写法二：从远程读取hosts文件
    {
        hosts:["https://hosts1.txt","https://hosts2.json"],
        noA:flase, noAAAA: true
    },
};
hosts文件支持两种格式：
[
  ["8.8.8.8","dns.google"],
  ["8.8.8.8","dns.google"]
]
[
  { "domain":"dns.google","ip":"8.8.8.8"},
  { "domain":"dns.google","ip":"8.8.8.8"}
]

```
#### 通过`rules` 参数或`X-Rules`请求头参数配置
- **域名**：必填，支持通配符 `*.`（匹配所有子域及根域）。可逗号分隔多个域名。
- **IP列表**：可选，多个 IP 用逗号分隔，支持 IPv4/IPv6。留空表示不提供自定义 IP。
- **标志**：可选，使用 `-` 分隔，支持 `noA`（屏蔽 A 记录）、`noAAAA`（屏蔽 AAAA 记录）。可同时使用。

**示例**：
`*.google.com:2001:4860:4827:7700::,142.250.80.78-noA`
`google.com,google.com.hk::noA-noAAAA`


## 自定义参数

所有参数均可通过 **URL 查询字符串** 或 **HTTP 请求头** 传入（请求头 `X-Ip4` 等）。

| 参数名        | 用途                                                                                     | 示例值                              |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| `ip4`         | CF 优选IPv4 替换地址                                    | `1.2.3.4,5.6.7.8`                  |
| `ip6`         | CF优选 IPv6 替换地址                                                     | `::1,::2`                           |
| `metaIp4`     | Meta 优选IPv4 替换地址                                                                 | `157.240.1.1`                       |
| `metaIp6`     | Meta 优选IPv6 替换地址                                                                 | `2a03:2880:...`                     |
| `cf`          | 解析优选域名 **仅对CF相关域名生效**        | `example.com,ip2.example.com`       |
| `meta`          | 解析优选域名 **仅对Meta相关域名生效**        | `example.com,ip2.example.com`       |
| `ech`         | 获取CF公共ECH配置的域名（默认 `cloudflare-ech.com`）                                      | `cloudflare-ech.com`               |
| `best` | 全局跟随优选 所有CF/META站点都使用优选IP 默认`false`|（`true`/`false`） | `false` |
| `clientip` |  自定义ECS,就近解析最佳结果 |默认自动获取（`/24`/ `::/26` ） |`自动获取`|
| `sub` | CF优选订阅链接 |格式（`ip-https://ip.txt`/ `cf-https://domain.txt` ） |``|
| `exclude` | 返回记录排除指定ip/domain |（`1.1.1.1`/ `cf.cf` ） |``|
| `shuffle` |  乱序返回记录 |默认`false`（`false`/ `true` ） |`false`|
| `area` |  指定ip区域 |留空`不过滤`（`area=hk,sg,jp` ） |``|
| `enhance` |  增强模式 fastly,Google直连 |可选`off` `rule` `full`    |``|
| `rules` |  增强模式域名ip匹配规则 |格式`*.domain1,*.domain2:ip1,ip2-noA-noAAAA`（`-noA/AAAA`屏蔽且不返回A/AAAA记录 ） |``|
| `alpn` |  alpn列表 |默认 `h3,h2`     |``|
| `no6` |  全局屏蔽AAAA记录 |默认 `false`     |``|
| `nocf6` |  屏蔽CF AAAA记录 |默认 `true`     |``|

> **ClientIP自动获取逻辑：部分客户端DNS请求获取不到CF-Connecting-IP，请主动填入clientIp**
```
客户端
  │
  │ DoH 请求
  ▼
Cloudflare Edge
  │
  │ 注入 CF-Connecting-IP
  ▼
Cloudflare Worker
  │
  │ 读取 CF-Connecting-IP
  ▼
构造 EDNS Client Subnet (ECS)
  │
  ▼
上游 DNS（Google Public DNS 等）
```

---
## 部署步骤

### 1. 部署到 Cloudflare Pages
- 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Pages** → **创建项目**。
- 上传资产或连接 Git 仓库，上传 `_worker.js` 至项目根目录。
- 部署完成后，访问分配的域名/绑定的自定义域名 即可。

### 2. 使用方法
- **前端网页测试查询**：直接访问首页（`/`），输入域名、选择类型，可展开高级选项填入自定义参数后查询。

- **DOH地址(完整参数示例)**：  
  ```
   "https://your-domain.pages.dev/ech?sub=ip-https://bestcf.pages.dev/gslege/Cfxyz.txt&best=true&shuffle=true&area=hk,jp,sg,us&exclude=bestcf.pages.dev&clientIp=1.2.4.8&cf=ip.sb,cloudflare-ech.com&ip4=162.159.39.22&ip6=2606:4700:839f:4fd6:ee45:836d:51a4:87b6"
  ```
- **配置 DoH 客户端**：  
  -- 将支持ECH的浏览器如Chrome/Firefox 的安全DNS设置为 DoH 地址设置：`https://你的域名/ech`，并可通过 URL 参数传递自定义内容。

  
  -- 使用代理工具：将需要直连的CF站点的域名解析服务器doh设置为`https://你的域名/ech`，并可通过请求头或 URL 参数传递自定义内容。
---
## 注意事项
- **子请求上限**：免费计划每日 10 万次子请求，已通过缓存降低使用量，正常个人使用一般不会超出。
- **ECH 有效性**：Meta 的 ECH 为固定配置（可能会过期），Cloudflare 的 ECH 从指定域名动态获取，可自定义 `ech` 参数。
- **隐私与安全**：上游查询使用 Google 和Quad9的公共 DNS JSON API，注意数据隐私（ **可自行替换为其他 DoH 服务**）。
  
## 项目特性

- ✅ **DoH 服务**  
  提供 `/ech`（注入 ECH）和 `/doh`（纯净转发）两个标准 DoH 端点，支持 GET/POST。
- ✅ **双上游竞速**  
  同时查询 Google DNS 和自选 DNS，取最快响应，提高解析速度。
- ✅ **全球边缘缓存**  
  利用 Cloudflare Cache API 缓存上游 DNS 结果（A/AAAA 300s，HTTPS 600s），大幅减少上游请求次数。
- ✅ **ECS就近解析**  
  默认自动获取发起doh查询的用户端ClientIP（支持自定义 clientip=x.x.x.x）,实现就近解析，同时在频繁切换网络环境时仍能保证最佳解析结果。
