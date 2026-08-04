/**
 * DOH-ECH 
 * - 双上游竞速 + Edge 缓存
 * - CF/Meta 静态域名 + IPv6 + 仅 IPv4 排除
 * - 增强模式 + 自定义规则
 * - HTTPS hints 复用归属探测 IP
 *********自定义参数***************
 * - best 控制全局跟随优选，所有CF站点均使用配置的优选结果 默认false
 * - clientIp ECS支持，默认自动获取
 * - cf 解析优选域名的ip记录返回
 * - sub  CF优选订阅，格式 ip-https://ip.txt, cf-https://domain.txt
 * - exclude 过滤排除不合适的优选ip/domain
 * - shuffle  返回记录随机乱序开关 默认true
 * - area    返回订阅列表指定区域的ip记录 格式： hk,sg,电信,移动,us
 * - no6  全局屏蔽AAAA记录 默认false
 * - enhance (off/rule/full),rule：按rules参数规则返回,full:为所有非CF/Meta站点开启
 * *  - alpn ［h3］非CF/META站点-仅在enhance开启时生效 | CF/META站点-全局生效
 * *  - rules   仅在enhance开启时生效, 传参格式：*domain1,*domain2:ip1,ip2-noA-noAAAA,按rules参数规则为指定域名返回alpn仅h3 的HTTPS记录和优选可达的iphints 以及按规则决定是否屏蔽A/AAAA记录
 * *  - mandatory 指定浏览器必须理解的HTTPS参数，否则忽略整条记录
 */
// ===================== 全局配置 =====================
const UPSTREAM_DNS_GOOGLE = 'https://dns.google/dns-query';
const UPSTREAM_JSON_GOOGLE = 'https://dns.google/resolve';
const UPSTREAM_DNS_CUSTOM = 'https://dns11.quad9.net/dns-query';//自行更换
const UPSTREAM_JSON_CUSTOM = 'https://dns11.quad9.net/dns-query';
const UPSTREAM_CN_JSON = 'https://dns.alidns.com/resolve';// 国内上游 DNS（阿里 DNS JSON API，仅用于国内域名）
const SVC_PARAM_IDS = { mandatory: 0, alpn: 1, "no-default-alpn": 2, port: 3, ipv4hint: 4, ech: 5, ipv6hint: 6};// SVC PARAMS构造
const IPV4_ONLY_DOMAINS = ["twitter.com", "x.com", "t.co", "twimg.com"];//只支持ipv4的CF/META域名列表：不返回AAAA记录和ipv6hint
//Cloudflare 配置
const DEFAULT_CF_IP = "104.18.10.118";//默认CF优选IPv4
const DEFAULT_CF_IP6 = "";//默认CF优选IPv6
const CF_STATIC_DOMAINS = ["twimg.com", "twitter.com", "x.com", "t.co","cloudflare-dns.com", "pages.dev", "workers.dev", "cloudflare.com"];//不查询-直接返回优选结果的CF域名列表
//Meta 配置
const DEFAULT_META_IP = "";//默认META优选IP
const META_DOMAINS = ["facebook.com", "messenger.com", "instagram.com","whatsapp.com", "fb.com", "meta.com"];//不查询-直接返回优选结果的META域名列表
const META_ECH_CONFIG = "AEj+DQBEAQAgACAdd+scUi0IYFsXnUIU7ko2Nd9+F8M26pAGZVpz/KrWPgAEAAEAAWQVZWNoLXB1YmxpYy5hdG1ldGEuY29tAAA=";//固定META ECH，过期自行更换

//enhance：rule/full下 ：增强规则列表,最高优先级，此列表内指定的ip直接作为A/AAAA IPhints返回，屏蔽记录规则优先级也高于全局屏蔽AAAA参数
const BUILTIN_HINTS = [
    {
        hosts:["https://raw.hellogithub.com/hosts.json"],
        noA:false, noAAAA: true
    },
    {
        // GWS (Google Web Server) 分类组：承载网页主体、核心搜索 API、人机验证和账户安全登录 && GGC
        domains: [ "*.google.com.hk", "*.google.com","*.googleapis.com", "*.services.googleapis.cn", "*.services.google.com", "*.accounts.google.com","*.youtube.com", "*.youtube-nocookie.com", "*.googleapis.cn","*.recaptcha.net"],
        ips: ["2001:4860:4826:7700::/64", "2001:4860:4827:7700::/64", "2001:4860:4828:7700::/64", "2001:4860:4829:7700::/64", "2001:4860:482a:7700::/64", "2001:4860:482b:7700::/64", "2001:4860:482c:7700::/64", "2001:4860:482d:7700::/64"],
        noA: true,// 强制屏蔽 IPv4只留ipv6记录以绕过 GFW 的 v4 封锁
        noAAAA: false
    },
    {
        // GVS (Google Video Server) 分类组：专属于 YouTube 视频和音频大文件切片流媒体分发
        domains: ["*.googlevideo.com"],
        ips: [],
        noA: true,  noAAAA: false   
    },
    {
        // GGC (Google Global Cache) 分类组：专门分流并加速网页样式、Web 字体、浏览器更新及视频封面等静态资源
        domains: ["*.googlesource.com","*.gstatic.com", "*.googleusercontent.com", "*.ytimg.com", "*.ggpht.com", "*.gvt1.com","*.gvt2.com","*.googleadservices.com","*.googlesyndication.com","*.google-analytics.com","*.crashlytics.com","firebaseio.com","firebasedatabase.app"],
        ips: ["2001:4860:4826:7700::/64", "2001:4860:4827:7700::/64", "2001:4860:4828:7700::/64", "2001:4860:4829:7700::/64", "2001:4860:482a:7700::/64", "2001:4860:482b:7700::/64", "2001:4860:482c:7700::/64", "2001:4860:482d:7700::/64"],
        noA: true,    noAAAA: false      
    },
    {  
        // Meta 全家桶(禁用ipv4)（Instagram、Threads、Facebook 等）[此规则高于Meta优选ip]
        domains: ["*.meta.com","*.facebook.com", "*.fb.com","*.instagram.com", "*.cdninstagram.com", "*.fbcdn.net", "*.threads.net"],
        ips: [],
        noA: true, noAAAA: false
    },
    {
        // Wikipedia 维基百科(禁用ipv4)（全球最大的百科知识库，其通用任播边缘全面部署了支持 HTTP/3 的 ATS 架构）
        domains: ["*.wikipedia.org", "*.wikimedia.org", "*.wikibooks.org", "*.wikidata.org"],
        ips: [],  noA: true, noAAAA: false
    },
   //Others(禁用ipv4)
    { domains: ["*.docker.com", "*.docker.io", "*.production.cloudflare.docker.com"], ips: [], noA: true, noAAAA: false },       
    //FastlyCDN优化(禁用ipv6)
    { domains: ["*.reddit.com", "*.redd.it", "*.redditmedia.com", "*.redditstatic.com"], ips: ["151.101.1.140", "151.101.65.140", "151.101.129.140", "151.101.193.140"], noA: false, noAAAA: true },
    { domains: ["*.imgur.com", "*.i.imgur.com", "*.api.imgur.com", "*.s.imgur.com"], ips: ["151.101.1.193", "151.101.65.193", "151.101.129.193", "151.101.193.193"], noA: false, noAAAA: true },
    { domains: ["*.giphy.com", "*.media.giphy.com", "*.giphy.gif", "*.api.giphy.com"], ips: ["151.101.1.132", "151.101.65.132", "151.101.129.132", "151.101.193.132"], noA: false, noAAAA: true },
    { domains: ["*.pypi.org", "*.pythonhosted.org", "*.files.pythonhosted.org"], ips: ["151.101.1.223", "151.101.65.223", "151.101.129.223", "151.101.193.223"], noA: false, noAAAA: true },
    { domains: ["*.stackoverflow.com", "*.stackexchange.com", "*.sstatic.net"], ips: ["151.101.1.69", "151.101.65.69", "151.101.129.69", "151.101.193.69"], noA: false, noAAAA: true },
    { domains: ["*.duckduckgo.com", "*.ddg.gg", "*.icons.duckduckgo.com"], ips: ["151.101.1.181", "151.101.65.181", "151.101.129.181", "151.101.193.181"], noA: false, noAAAA: true },
    { domains: ["*.medium.com", "*.readmedium.com", "*.miro.medium.com"], ips: ["151.101.1.162", "151.101.65.162", "151.101.129.162", "151.101.193.162"], noA: false, noAAAA: true },
    { domains: ["*.pinterest.com", "*.pinimg.com", "*.pinterest.io", "*.media.pinterest.com"], ips: ["151.101.1.84", "151.101.65.84", "151.101.129.84", "151.101.193.84"], noA: false, noAAAA: true } 
    // 传统简单写法仍可混用（自动转换）
   //   ["*.googlevideo.com"] // 等价于 { domains: ["*.googlevideo.com"], ips: [], noA: false, noAAAA: false }
];

//CIDR归属列表
const RAW_META_CIDRS = ['31.13.24.0/21','31.13.64.0/18','45.64.40.0/22','57.141.0.0/24','57.141.2.0/23','57.141.4.0/22','57.141.8.0/21','57.141.16.0/23','57.144.0.0/14','66.220.144.0/20','69.63.176.0/20','69.171.224.0/19','74.119.76.0/22','102.132.96.0/20','102.132.112.0/24','102.132.114.0/23','102.132.116.0/23','102.132.119.0/24','102.132.120.0/23','102.132.123.0/24','102.132.125.0/24','102.132.126.0/23','102.221.188.0/22','103.4.96.0/22','129.134.0.0/17','129.134.130.0/24','129.134.135.0/24','129.134.136.0/22','129.134.140.0/24','129.134.143.0/24','129.134.144.0/24','129.134.147.0/24','129.134.148.0/23','129.134.154.0/23','129.134.156.0/22','129.134.160.0/22','129.134.164.0/23','129.134.168.0/21','129.134.176.0/20','129.134.194.0/24','157.240.0.0/17','157.240.128.0/23','157.240.131.0/24','157.240.132.0/24','157.240.134.0/24','157.240.136.0/23','157.240.139.0/24','157.240.156.0/23','157.240.159.0/24','157.240.169.0/24','157.240.175.0/24','157.240.177.0/24','157.240.179.0/24','157.240.181.0/24','157.240.182.0/23','157.240.184.0/21','157.240.192.0/18','163.70.128.0/17','163.77.132.0/23','163.77.136.0/23','163.114.128.0/20','173.252.64.0/18','179.60.192.0/22','185.60.216.0/22','185.89.216.0/22','199.201.64.0/22','204.15.20.0/22','2620:0:1c00::/40','2620:10d:c090::/44','2a03:2880::/32','2a03:2887:ff00::/48','2a03:2887:ff02::/48','2a03:2887:ff04::/46','2a03:2887:ff09::/48','2a03:2887:ff0a::/48','2a03:2887:ff1b::/48','2a03:2887:ff1c::/48','2a03:2887:ff1e::/48','2a03:2887:ff20::/48','2a03:2887:ff22::/47','2a03:2887:ff27::/48','2a03:2887:ff28::/46','2a03:2887:ff2f::/48','2a03:2887:ff30::/48','2a03:2887:ff33::/48','2a03:2887:ff37::/48','2a03:2887:ff38::/46','2a03:2887:ff3f::/48','2a03:2887:ff40::/46','2a03:2887:ff44::/47','2a03:2887:ff48::/46','2a03:2887:ff4d::/48','2a03:2887:ff4e::/47','2a03:2887:ff50::/45','2a03:2887:ff58::/47','2a03:2887:ff5a::/48','2a03:2887:ff5f::/48','2a03:2887:ff60::/48','2a03:2887:ff62::/47','2a03:2887:ff64::/46','2a03:2887:ff68::/47','2a03:2887:ff6a::/48','2a03:2887:ff70::/47','2c0f:ef78:3::/48','2c0f:ef78:5::/48','2c0f:ef78:9::/48','2c0f:ef78:c::/47','2c0f:ef78:e::/48','2c0f:ef78:10::/47'];
const RAW_CF_CIDRS = ['5.10.214.0/23','5.10.244.0/22','5.175.141.0/24','5.182.84.0/23','5.226.179.0/24','5.226.181.0/24','5.226.183.0/24','8.6.112.0/24','8.6.144.0/23','8.9.231.0/24','8.10.148.0/24','8.14.199.0/24','8.14.201.0/24','8.14.202.0/24','8.14.204.0/24','8.17.205.0/24','8.17.206.0/23','8.18.50.0/24','8.18.113.0/24','8.18.195.0/24','8.18.196.0/24','8.19.8.0/24','8.20.100.0/23','8.20.103.0/24','8.20.122.0/23','8.20.124.0/23','8.20.126.0/24','8.21.8.0/23','8.21.10.0/24','8.21.12.0/23','8.21.110.0/23','8.21.239.0/24','8.23.139.0/24','8.23.240.0/24','8.24.87.0/24','8.24.243.0/24','8.24.244.0/24','8.25.96.0/23','8.25.249.0/24','8.26.182.0/24','8.27.64.0/24','8.27.66.0/23','8.27.68.0/23','8.27.79.0/24','8.28.20.0/24','8.28.82.0/24','8.28.126.0/23','8.28.213.0/24','8.29.105.0/24','8.29.109.0/24','8.29.228.0/24','8.29.230.0/23','8.30.234.0/24','8.31.2.0/24','8.31.160.0/23','8.34.69.0/24','8.34.70.0/23','8.34.146.0/24','8.34.201.0/24','8.34.202.0/24','8.35.57.0/24','8.35.58.0/24','8.35.149.0/24','8.35.211.0/24','8.36.216.0/22','8.36.220.0/24','8.37.41.0/24','8.37.43.0/24','8.38.147.0/24','8.38.148.0/23','8.39.6.0/24','8.39.18.0/24','8.39.125.0/24','8.39.126.0/24','8.39.201.0/24','8.39.202.0/23','8.39.204.0/22','8.39.213.0/24','8.39.214.0/23','8.40.26.0/23','8.40.29.0/24','8.40.30.0/23','8.40.107.0/24','8.40.111.0/24','8.40.140.0/24','8.41.5.0/24','8.41.6.0/23','8.41.36.0/23','8.42.51.0/24','8.42.54.0/23','8.42.161.0/24','8.42.164.0/24','8.42.172.0/24','8.43.121.0/24','8.43.122.0/23','8.43.224.0/23','8.43.226.0/24','8.44.2.0/24','8.44.6.0/24','8.44.60.0/24','8.44.62.0/23','8.45.41.0/24','8.45.43.0/24','8.45.44.0/22','8.45.97.0/24','8.45.100.0/23','8.45.102.0/24','8.45.108.0/24','8.45.111.0/24','8.45.145.0/24','8.45.146.0/23','8.46.113.0/24','8.46.115.0/24','8.46.117.0/24','8.46.118.0/23','8.47.9.0/24','8.47.12.0/23','8.47.15.0/24','8.47.69.0/24','8.47.71.0/24','8.48.130.0/23','8.48.132.0/23','8.48.134.0/24','14.102.228.0/23','23.131.204.0/24','23.145.136.0/24','23.145.152.0/24','23.145.232.0/24','23.145.248.0/24','23.167.152.0/24','23.178.112.0/24','23.179.248.0/24','23.180.136.0/24','23.227.37.0/24','23.227.38.0/23','23.227.48.0/23','23.227.60.0/24','23.247.163.0/24','25.25.25.0/24','25.26.27.0/24','25.129.196.0/22','27.50.48.0/23','31.12.75.0/24','31.43.179.0/24','31.185.108.0/24','37.153.171.0/24','38.96.28.0/23','44.31.142.0/24','45.8.211.0/24','45.12.30.0/23','45.80.108.0/24','45.80.110.0/23','45.81.58.0/24','45.85.118.0/23','45.95.241.0/24','45.128.76.0/24','45.130.125.0/24','45.131.4.0/22','45.131.208.0/22','45.135.235.0/24','45.142.120.0/24','45.146.201.0/24','45.149.12.0/24','45.153.7.0/24','45.157.17.0/24','45.192.222.0/23','45.192.224.0/24','45.194.11.0/24','45.194.53.0/24','45.195.14.0/24','45.196.29.0/24','45.199.183.0/24','45.202.113.0/24','45.205.0.0/24','45.250.154.0/23','46.202.30.0/24','46.254.92.0/23','49.213.44.0/24','49.238.236.0/22','61.32.240.0/24','62.72.166.0/24','62.146.255.0/24','62.169.155.0/24','64.40.138.0/24','64.40.140.0/24','64.69.24.0/23','64.239.31.0/24','65.110.63.0/24','65.205.150.0/24','66.45.118.0/24','66.71.220.0/24','66.81.247.0/24','66.81.255.0/24','66.84.82.0/24','66.93.178.0/24','66.94.32.0/20','66.203.249.0/24','66.225.252.0/24','66.235.200.0/24','68.169.48.0/20','68.182.187.0/24','69.48.218.0/24','69.89.0.0/20','69.90.210.0/24','72.52.113.0/24','74.49.214.0/23','74.204.59.0/24','74.205.180.0/24','77.37.33.0/24','77.74.228.0/24','77.75.199.0/24','77.105.163.0/24','77.111.106.0/24','77.232.140.0/24','78.128.122.0/24','80.93.202.0/24','82.21.82.0/24','82.22.16.0/24','82.26.156.0/24','82.118.242.0/24','82.139.216.0/23','83.118.224.0/22','86.38.214.0/24','86.38.251.0/24','87.229.48.0/24','88.216.66.0/23','88.216.69.0/24','89.47.56.0/23','89.106.90.0/24','89.116.46.0/24','89.116.161.0/24','89.116.180.0/24','89.116.250.0/24','89.117.112.0/24','89.207.18.0/24','89.249.200.0/24','91.124.127.0/24','91.192.106.0/24','91.193.58.0/23','91.199.81.0/24','91.206.71.0/24','91.209.253.0/24','92.53.188.0/22','92.60.74.0/24','92.243.74.0/23','93.114.64.0/23','93.115.102.0/24','94.140.0.0/24','94.156.10.0/24','94.247.142.0/24','96.43.100.0/23','102.132.188.0/24','102.177.176.0/24','102.177.189.0/24','103.11.212.0/24','103.11.214.0/24','103.15.85.0/24','103.19.144.0/23','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','103.31.79.0/24','103.81.228.0/24','103.112.176.0/24','103.116.7.0/24','103.121.59.0/24','103.133.1.0/24','103.135.208.0/23','103.169.142.0/24','103.172.110.0/23','103.186.74.0/24','103.198.92.0/24','103.204.13.0/24','103.215.22.0/24','103.219.64.0/22','103.245.228.0/23','104.16.0.0/13','104.24.0.0/14','104.28.0.0/16','104.29.0.0/21','104.29.8.0/23','104.29.11.0/24','104.29.12.0/22','104.29.16.0/23','104.29.19.0/24','104.29.20.0/22','104.29.24.0/21','104.29.32.0/24','104.29.34.0/23','104.29.36.0/22','104.29.40.0/22','104.29.44.0/23','104.29.47.0/24','104.29.48.0/23','104.29.50.0/24','104.29.52.0/22','104.29.57.0/24','104.29.59.0/24','104.29.61.0/24','104.29.62.0/23','104.29.64.0/23','104.29.67.0/24','104.29.68.0/22','104.29.72.0/21','104.29.80.0/23','104.29.82.0/24','104.29.85.0/24','104.29.86.0/24','104.29.88.0/21','104.29.96.0/22','104.29.100.0/23','104.29.102.0/24','104.29.104.0/21','104.29.112.0/22','104.29.116.0/23','104.29.121.0/24','104.29.122.0/23','104.29.124.0/22','104.29.128.0/18','104.30.0.0/19','104.30.32.0/23','104.30.128.0/23','104.30.132.0/22','104.30.136.0/23','104.30.144.0/21','104.30.160.0/19','104.31.0.0/21','104.31.16.0/22','104.31.20.0/24','104.36.195.0/24','104.129.164.0/22','104.156.176.0/23','104.165.248.0/24','104.234.239.0/24','104.239.72.0/24','104.254.140.0/24','108.162.192.0/18','108.165.152.0/24','108.165.216.0/24','109.234.211.0/24','114.129.43.0/24','123.108.75.0/24','130.108.73.0/24','130.108.104.0/23','130.108.121.0/24','130.108.253.0/24','131.0.72.0/22','131.167.255.0/24','136.143.138.0/24','137.66.96.0/24','138.5.248.0/24','138.226.234.0/24','138.249.21.0/24','139.64.234.0/23','140.99.233.0/24','141.11.202.0/23','141.101.64.0/18','141.193.213.0/24','143.14.224.0/24','143.14.229.0/24','143.14.251.0/24','143.20.247.0/24','144.124.211.0/24','147.78.140.0/24','147.185.161.0/24','148.227.167.0/24','150.48.128.0/18','151.243.128.0/22','151.243.133.0/24','151.246.216.0/23','152.114.0.0/17','152.114.128.0/18','154.51.129.0/24','154.51.160.0/24','154.62.129.0/24','154.81.141.0/24','154.83.2.0/24','154.83.22.0/23','154.83.30.0/24','154.84.14.0/23','154.84.16.0/24','154.84.18.0/24','154.84.20.0/23','154.84.24.0/24','154.84.26.0/23','154.90.70.0/24','154.92.9.0/24','154.193.133.0/24','154.193.184.0/24','154.194.12.0/24','154.194.225.0/24','154.197.64.0/23','154.197.75.0/24','154.197.80.0/24','154.197.88.0/24','154.197.108.0/24','154.197.121.0/24','154.198.173.0/24','154.200.89.0/24','154.202.89.0/24','154.206.12.0/24','154.207.77.0/24','154.207.79.0/24','154.207.127.0/24','154.207.189.0/24','154.207.252.0/23','154.211.8.0/24','154.218.15.0/24','154.219.5.0/24','154.223.134.0/23','155.46.167.0/24','155.46.213.0/24','156.224.73.0/24','156.225.72.0/24','156.243.83.0/24','156.243.246.0/24','156.246.69.0/24','156.246.70.0/24','156.252.2.0/23','156.255.123.0/24','158.94.212.0/24','159.112.235.0/24','159.242.242.0/24','159.246.55.0/24','160.153.0.0/24','161.248.134.0/23','162.44.32.0/22','162.44.118.0/23','162.44.208.0/23','162.120.94.0/24','162.158.0.0/15','162.251.82.0/24','162.251.205.0/24','164.38.155.0/24','164.77.28.0/23','165.101.60.0/23','167.1.137.0/24','167.1.148.0/23','167.1.150.0/24','167.1.181.0/24','167.68.4.0/23','167.68.11.0/24','167.68.42.0/24','167.74.94.0/23','167.74.130.0/24','169.40.133.0/24','169.197.101.0/24','170.114.45.0/24','170.114.46.0/24','170.114.52.0/24','170.114.78.0/24','170.168.7.0/24','170.176.152.0/24','170.176.163.0/24','172.64.0.0/13','172.83.72.0/23','172.83.76.0/24','173.0.92.0/24','173.245.48.0/20','176.103.113.0/24','176.124.223.0/24','176.126.206.0/23','178.94.249.0/24','178.211.142.0/24','178.213.76.0/24','181.214.1.0/24','182.23.210.0/24','184.174.80.0/24','185.7.190.0/23','185.7.240.0/24','185.18.184.0/24','185.18.250.0/24','185.29.76.0/24','185.38.25.0/24','185.38.135.0/24','185.60.251.0/24','185.122.0.0/24','185.126.66.0/24','185.132.85.0/24','185.132.86.0/23','185.133.172.0/24','185.135.9.0/24','185.146.172.0/23','185.148.104.0/22','185.149.135.0/24','185.156.19.0/24','185.158.133.0/24','185.159.247.0/24','185.162.228.0/22','185.170.166.0/24','185.176.24.0/24','185.176.26.0/24','185.178.196.0/22','185.193.28.0/22','185.207.92.0/24','185.207.196.0/22','185.209.154.0/24','185.229.206.0/24','185.238.228.0/24','185.251.80.0/23','188.42.88.0/23','188.42.98.0/24','188.42.145.0/24','188.95.12.0/24','188.114.96.0/20','188.164.158.0/23','188.164.248.0/24','188.244.122.0/24','190.93.240.0/20','192.65.217.0/24','192.71.82.0/24','192.86.150.0/24','192.103.56.0/24','192.133.11.0/24','192.152.138.0/24','192.236.26.0/24','193.8.237.0/24','193.9.49.0/24','193.16.63.0/24','193.17.206.0/24','193.67.144.0/24','193.124.18.0/24','193.124.224.0/24','193.162.35.0/24','193.202.90.0/24','193.227.99.0/24','193.233.21.0/24','193.233.132.0/24','194.1.194.0/24','194.26.68.0/24','194.36.49.0/24','194.36.55.0/24','194.39.112.0/21','194.41.114.0/24','194.53.53.0/24','194.59.5.0/24','194.113.223.0/24','194.152.44.0/24','194.169.194.0/24','195.26.229.0/24','195.28.190.0/23','195.82.109.0/24','195.85.23.0/24','195.85.59.0/24','195.189.177.0/24','195.242.122.0/23','195.245.221.0/24','195.250.46.0/24','196.13.241.0/24','196.207.45.0/24','197.234.240.0/22','198.41.128.0/17','198.177.56.0/23','198.202.211.0/24','198.217.251.0/24','198.252.206.0/24','199.5.242.0/24','199.27.128.0/21','199.33.230.0/23','199.33.232.0/23','199.60.103.0/24','199.181.197.0/24','200.73.67.0/24','202.27.69.0/24','202.82.250.0/24','203.6.66.0/24','203.6.74.0/24','203.13.32.0/24','203.17.126.0/24','203.19.222.0/24','203.22.223.0/24','203.22.241.0/24','203.23.103.0/24','203.23.104.0/24','203.23.106.0/24','203.24.102.0/23','203.24.108.0/23','203.28.8.0/23','203.29.52.0/22','203.30.188.0/22','203.32.120.0/23','203.34.28.0/24','203.34.80.0/24','203.55.107.0/24','203.89.5.0/24','203.168.128.0/22','203.168.192.0/20','204.62.141.0/24','204.68.111.0/24','204.69.207.0/24','204.153.16.0/24','204.195.192.0/18','205.233.181.0/24','207.189.149.0/24','208.42.188.0/24','208.77.33.0/24','208.77.35.0/24','208.88.71.0/24','208.100.60.0/24','209.46.30.0/24','209.55.226.0/24','209.55.232.0/24','209.55.234.0/24','209.55.246.0/23','209.55.253.0/24','209.55.254.0/24','209.222.114.0/23','212.6.39.0/24','212.22.76.0/24','212.104.128.0/24','212.239.86.0/24','213.182.199.0/24','213.219.247.0/24','213.241.198.0/24','216.19.107.0/24','216.74.106.0/24','216.120.131.0/24','216.120.180.0/23','216.154.208.0/20','216.163.179.0/24','216.198.53.0/24','216.198.54.0/24','216.205.52.0/24','216.224.121.0/24','223.27.176.0/23','2001:503:ff40::/46','2001:678:19c::/48','2001:df7:6e80::/48','2400:c760:a::/48','2400:cb00::/32','2405:8100::/32','2405:b500::/32','2407:30c0:180::/46','2602:80c:cf::/48','2602:f660::/40','2602:f830::/48','2606:2c0:20::/47','2606:2c40::/48','2606:4700::/32','2606:54c0::/32','2606:54c1::/48','2606:54c1:2::/47','2606:54c1:6::/47','2606:54c1:8::/46','2606:54c1:c::/47','2606:54c1:10::/46','2606:54c2::/47','2606:54c2:2::/48','2606:54c3::/45','2606:ae80:10::/48','2607:8940:2000::/35','2607:9240:201::/48','2607:9240:202::/47','2620:78:200f::/48','2620:cb:2000::/48','2620:117:bfb0::/44','2620:127:f00c::/46','2620:12c:90af::/48','2620:132:1000::/48','2803:f800::/32','2a02:d21:20::/44','2a03:f940::/48','2a05:7880::/32','2a06:98c0::/29','2a06:9ac0::/32','2a07:180::/32','2a08:600::/48','2a08:600:e0::/47','2a08:600:ee::/47','2a08:600:ff::/48','2a09:bac0:4::/48','2a09:bac0:11::/48','2a09:bac0:12::/48','2a09:bac0:14::/46','2a09:bac0:19::/48','2a09:bac0:20::/46','2a09:bac0:26::/47','2a09:bac0:28::/47','2a09:bac0:31::/48','2a09:bac0:34::/47','2a09:bac0:38::/47','2a09:bac0:40::/48','2a09:bac0:43::/48','2a09:bac0:44::/47','2a09:bac0:47::/48','2a09:bac0:48::/47','2a09:bac0:50::/48','2a09:bac0:52::/48','2a09:bac0:54::/48','2a09:bac0:57::/48','2a09:bac0:59::/48','2a09:bac0:63::/48','2a09:bac0:64::/46','2a09:bac0:68::/47','2a09:bac0:70::/46','2a09:bac0:74::/47','2a09:bac0:78::/47','2a09:bac0:80::/47','2a09:bac0:83::/48','2a09:bac0:84::/47','2a09:bac0:87::/48','2a09:bac0:88::/47','2a09:bac0:94::/48','2a09:bac0:96::/47','2a09:bac0:98::/48','2a09:bac0:100::/48','2a09:bac0:102::/47','2a09:bac0:106::/47','2a09:bac0:109::/48','2a09:bac0:113::/48','2a09:bac0:114::/47','2a09:bac0:116::/48','2a09:bac0:119::/48','2a09:bac0:120::/47','2a09:bac0:123::/48','2a09:bac0:124::/47','2a09:bac0:128::/48','2a09:bac0:130::/48','2a09:bac0:132::/48','2a09:bac0:134::/48','2a09:bac0:136::/47','2a09:bac0:138::/48','2a09:bac0:143::/48','2a09:bac0:145::/48','2a09:bac0:149::/48','2a09:bac0:151::/48','2a09:bac0:152::/47','2a09:bac0:154::/47','2a09:bac0:156::/48','2a09:bac0:158::/47','2a09:bac0:160::/48','2a09:bac0:162::/48','2a09:bac0:165::/48','2a09:bac0:166::/47','2a09:bac0:168::/47','2a09:bac0:172::/48','2a09:bac0:174::/48','2a09:bac0:181::/48','2a09:bac0:185::/48','2a09:bac0:192::/47','2a09:bac0:194::/48','2a09:bac0:196::/47','2a09:bac0:199::/48','2a09:bac0:202::/47','2a09:bac0:212::/48','2a09:bac0:216::/47','2a09:bac0:218::/48','2a09:bac0:227::/48','2a09:bac0:228::/48','2a09:bac0:237::/48','2a09:bac0:243::/48','2a09:bac0:246::/48','2a09:bac0:254::/48','2a09:bac0:268::/47','2a09:bac0:270::/48','2a09:bac0:275::/48','2a09:bac0:281::/48','2a09:bac0:282::/47','2a09:bac0:284::/47','2a09:bac0:298::/47','2a09:bac0:301::/48','2a09:bac0:337::/48','2a09:bac0:338::/47','2a09:bac0:341::/48','2a09:bac0:343::/48','2a09:bac0:346::/48','2a09:bac0:352::/48','2a09:bac0:358::/48','2a09:bac0:360::/48','2a09:bac0:374::/48','2a09:bac0:376::/48','2a09:bac0:380::/47','2a09:bac0:382::/48','2a09:bac0:384::/47','2a09:bac0:388::/48','2a09:bac0:390::/47','2a09:bac0:393::/48','2a09:bac0:403::/48','2a09:bac0:404::/48','2a09:bac0:407::/48','2a09:bac0:408::/48','2a09:bac0:411::/48','2a09:bac0:412::/48','2a09:bac0:423::/48','2a09:bac0:428::/48','2a09:bac0:431::/48','2a09:bac0:439::/48','2a09:bac0:441::/48','2a09:bac0:445::/48','2a09:bac0:448::/48','2a09:bac0:450::/48','2a09:bac0:453::/48','2a09:bac0:455::/48','2a09:bac0:458::/48','2a09:bac0:462::/48','2a09:bac0:464::/48','2a09:bac0:466::/47','2a09:bac0:470::/48','2a09:bac0:472::/48','2a09:bac0:476::/47','2a09:bac0:478::/48','2a09:bac0:481::/48','2a09:bac0:483::/48','2a09:bac0:485::/48','2a09:bac0:497::/48','2a09:bac0:507::/48','2a09:bac0:522::/47','2a09:bac0:525::/48','2a09:bac0:532::/47','2a09:bac0:534::/48','2a09:bac0:537::/48','2a09:bac0:538::/48','2a09:bac0:542::/47','2a09:bac0:557::/48','2a09:bac0:558::/47','2a09:bac0:566::/47','2a09:bac0:572::/47','2a09:bac0:574::/48','2a09:bac0:581::/48','2a09:bac0:582::/47','2a09:bac0:594::/48','2a09:bac0:597::/48','2a09:bac0:598::/48','2a09:bac0:601::/48','2a09:bac0:612::/48','2a09:bac0:618::/47','2a09:bac0:626::/48','2a09:bac0:631::/48','2a09:bac0:632::/47','2a09:bac0:636::/47','2a09:bac0:641::/48','2a09:bac0:646::/48','2a09:bac0:649::/48','2a09:bac0:650::/48','2a09:bac0:658::/48','2a09:bac0:663::/48','2a09:bac0:670::/48','2a09:bac0:677::/48','2a09:bac0:679::/48','2a09:bac0:684::/48','2a09:bac0:694::/48','2a09:bac0:704::/48','2a09:bac0:711::/48','2a09:bac0:712::/48','2a09:bac0:719::/48','2a09:bac0:721::/48','2a09:bac0:724::/47','2a09:bac0:735::/48','2a09:bac0:745::/48','2a09:bac0:748::/48','2a09:bac0:920::/48','2a09:bac0:1000::/47','2a09:bac0:1008::/45','2a09:bac1::/32','2a09:bac2::/31','2a09:bac4::/30','2a0a:6c80::/29','2a0b:4144::/48','2a0b:85c7:ffff::/48','2a13:9500:3e::/48','2a14:7ac0::/48','2a14:a087::/47','2c0f:f248::/32'];
// 第三方维护的国内域名列表
const CN_DOMAIN_LIST_URL = 'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/direct-list.txt';
// 国内域名后备后缀（远程列表加载失败时使用）
const CN_DOMAIN_SUFFIXES = ['jd.com','meituan.com','taobao.com', '.cn', '.com.cn', '.net.cn', '.org.cn', '.gov.cn'];

// ===================== 缓存逻辑 =====================
let cnDomainSet = null;
let cnDomainLastFetch = 0;
globalThis._workerStartTime = globalThis_workerStartTime || Date.now();
const CN_DOMAIN_CACHE_TTL = 7 * 24 * 3600 * 1000;   // 每7天更新CN列表
const cacheMap = new Map();
const CACHE_TTL = 7 * 24 * 3600 * 1000;         //归属探测缓存7天
const ECH_CACHE_TTL = 3600 * 1000;              //ech缓存1小时
const SUB_CACHE_TTL =  24 * 3600 * 1000;      //订阅缓存1天
const subCache = new Map();
const RANDOM_IPV6_COUNT = 2;                  // 每个前缀生成 2 个随机 IP
const PREFIX_CACHE_TTL = 24 * 3600 * 1000;       // 前缀缓存24小时
const prefixCache = new Map();
const MAX_PRESCREEN = 10;//候选记录最多条目
const MAX_FINAL = 6;//记录最终返回最多条目
const HOSTS_CACHE_TTL =24 * 3600 * 1000;   // hosts 缓存24小时
const hostsCache = new Map();
// 延迟编译 CIDR 
let compiledMeta = null, compiledCF = null;
function getCompiledMeta() { if (!compiledMeta) compiledMeta = compileCidrs(RAW_META_CIDRS); return compiledMeta; }
function getCompiledCF()   { if (!compiledCF)   compiledCF   = compileCidrs(RAW_CF_CIDRS);   return compiledCF; }

// ===================== 参数构建 =====================
function buildConfig(url, headers = null) {
    const get = (p, h) => (url.searchParams.get(p) || (headers ? headers.get(h) : null)) || '';
   
 const config =  {
        ip4: get('ip4', 'X-Ip4'), ip6: get('ip6', 'X-Ip6'),
        metaIp4: get('metaIp4', 'X-MetaIp4'), metaIp6: get('metaIp6', 'X-MetaIp6'),
        cfDomain: get('cf', 'X-CF'), metaDomain: get('meta', 'X-Meta'),
        echDomain: get('ech', 'X-ECH') || 'cloudflare-ech.com',
        best: get('best', 'X-Best') || 'false', sub: get('sub', 'X-Sub'),
        exclude: get('exclude', 'X-Exclude'), shuffle: get('shuffle', 'X-Shuffle') || 'true',
        area: get('area', 'X-Area'), enhance: get('enhance', 'X-Enhance') || 'rule',
        rules: get('rules', 'X-Rules'), alpn: get('alpn', 'X-Alpn') || 'h3,h2',
        clientIp: get('clientIp', 'X-ClientIP') || '',
        no6: get('no6', 'X-No6') || 'false',   
        mandatory: get('mandatory', 'X-Mandatory') || 'alpn',
        nocf6: get('nocf6', 'X-NoCF6') || 'true'
    };
    config.ip4 = prescreenIpList(config.ip4);//预筛选
    config.ip6 = prescreenIpList(config.ip6);
    return config;
}

// ===================== Worker 入口 =====================
export default {
    async fetch(req, env, ctx) {
        // 异步预热国内域名列表/CF ECH配置/hosts文件
        ctx.waitUntil(ensureCNDomainSet());
        ctx.waitUntil(fetchRealEch('cloudflare-ech.com', ''));
         ctx.waitUntil(getBuiltinRulesMap());
        const url = new URL(req.url);
        if (url.pathname === '/log') {return handleLogsRequest();}
        const clientIP = url.searchParams.get('clientIp') || req.headers.get('X-ClientIP') || req.headers.get('CF-Connecting-IP') || '1.2.4.8';
        if (url.pathname === '/api/query') return handleApiQuery(url, clientIP);
        if (url.pathname === '/ech') return handleDoHRequest(req, true, ctx, clientIP);
        if (url.pathname === '/doh') return handleDoHRequest(req, false, ctx, clientIP);
        return new Response(getHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
};

// ===================== DoH 处理 =====================
async function handleDoHRequest(req, injectEch, ctx, clientIP) {
    const url = new URL(req.url);
    const config = buildConfig(url, req.headers);
    if (!config.clientIp) config.clientIp = clientIP;
    await applySubConfig(config);   

    if (req.method === 'POST') {
        const buf = await req.arrayBuffer();
        if (injectEch) return handleDnsQuery(buf, config, ctx, config.clientIp);
        const res = await forwardQuery(buf);
        return dnsResponse(await res.arrayBuffer());
    }
    if (req.method === 'GET' && url.searchParams.get('dns')) {
        const raw = url.searchParams.get('dns').replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
        const buf = Uint8Array.from(atob(raw), c => c.charCodeAt(0)).buffer;
        if (injectEch) return handleDnsQuery(buf, config, ctx, config.clientIp);
        const res = await forwardQuery(buf);
        return dnsResponse(await res.arrayBuffer());
    }
    return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
}

// ===================== DNS 查询入口 =====================
async function handleDnsQuery(rawBuffer, config, ctx, clientIP) {
    try {
        const query = parseDnsPacket(rawBuffer);
        if (!query?.questions?.length) return forwardQuery(rawBuffer);
        const { id, questions } = query;
        const qType = questions[0].type;
        const qName = questions[0].name.toLowerCase().replace(/\.$/, "");

        // 假名处理
        if (qName === "cf.ech" || qName === "fb.ech") {
            if (qType === 65) {
                const randomTtl = Math.floor(Math.random() * (10800 - 7200 + 1)) + 7200;
                const echRdata = await buildFakeEchResponse(config, qName, clientIP, qName === "cf.ech");
                return dnsResponse(createMultiAnsResponse(id, qName, 65, echRdata ? [echRdata] : [], echRdata ? randomTtl : 60));
            }
            return dnsResponse(createMultiAnsResponse(id, qName, qType, [], 3600));
        }

        const isStaticCF = CF_STATIC_DOMAINS.some(d => qName === d || qName.endsWith("." + d));
        const isStaticMeta = META_DOMAINS.some(d => qName === d || qName.endsWith("." + d));

        if (isStaticCF || isStaticMeta) {
            const result = await resolveDNS(qName, qType === 28 ? 'AAAA' : (qType === 65 ? 'HTTPS' : 'A'), config, clientIP);
            return dnsResponseFromResult(id, qName, qType, result);
        }

        // 非静态域名 + HTTPS + 无增强 → 透明转发
        if (qType === 65 && (!config.enhance || config.enhance === 'off')) {
            const res = await forwardQuery(rawBuffer);
            return dnsResponse(await res.arrayBuffer());
        }

        const resolved = await resolveDNS(qName, qType === 28 ? 'AAAA' : (qType === 65 ? 'HTTPS' : 'A'), config, clientIP);
        if (resolved.error) return forwardQuery(rawBuffer);
        return dnsResponseFromResult(id, qName, qType, resolved);
    } catch (e) {
        console.error(e);
        return forwardQuery(rawBuffer);
    }
}

function dnsResponseFromResult(id, qName, qType, result) {
    if (qType === 65) {
        const rdata = result.httpsRecord ? [result.httpsRecord] : [];
        return dnsResponse(createMultiAnsResponse(id, qName, 65, rdata, rdata.length ? 300 : 60));
    }
    const bytes = qType === 28 ? ipv6ToBytes : ipToBytes;
    const answers = (result.answers || []).map(bytes);
    return dnsResponse(createMultiAnsResponse(id, qName, qType, answers, 300));
}

// ===================== JSON API =====================
async function handleApiQuery(url, clientIP) {
    const domain = url.searchParams.get('domain');
    const type = url.searchParams.get('type')?.toUpperCase() || 'A';
    if (!domain) return json({ error: '缺少 domain' }, 400);
    if (!['A', 'AAAA', 'HTTPS', 'CNAME', 'TXT', 'MX', 'NS'].includes(type)) return json({ error: '类型不支持' }, 400);
    const config = buildConfig(url);
    if (!config.clientIp) config.clientIp = clientIP;
    await applySubConfig(config);

    try {
        const result = await resolveDNS(domain, type, config, config.clientIp);
        if (result.httpsRecord) delete result.httpsRecord;
        return json(result);
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

// ===================== 核心调度 =====================
async function resolveDNS(domain, type, config, clientIP) {
    domain = domain.toLowerCase().replace(/\.$/, '');
    // 国内域名分流：直接返回国内上游原始解析结果
    ensureCNDomainSet();
    if (isCNDomain(domain)) {
        return await handleCNDomain(domain, type, config, clientIP);
    }
    const best = config.best === 'true';

    const isStaticCF = CF_STATIC_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
    const isStaticMeta = META_DOMAINS.some(d => domain === d || domain.endsWith("." + d));

    let owner = isStaticCF ? 'CF' : (isStaticMeta ? 'META' : null);

    const getOwner = async () => {
        const key = `owner:${domain}`;
        const cached = cacheMap.get(key);
        if (cached && Date.now() < cached.expire) return cached.value?.owner || null;
        const probe = await activeProbeOwner(domain, null, clientIP);
        return probe?.owner || null;
    };

    if (!owner && type === 'HTTPS') owner = await getOwner();

    let effectiveCF = isStaticCF, effectiveMeta = isStaticMeta;
    if (!effectiveCF && !effectiveMeta && best) {
        const realOwner = owner || await getOwner();
        if (realOwner === 'CF') effectiveCF = true;
        else if (realOwner === 'META') effectiveMeta = true;
    }
// A/AAAA 处理    
    if (type === 'A' || type === 'AAAA') {
     // 独立控制的CF站点禁用IPv6 默认即禁用（可通过 nocf6=false 关闭）
        if (type === 'AAAA' && config.nocf6 !== 'false' && effectiveCF) {
           return { domain, type, answers: [], ech: null };
        }     
     // 全局 IPv6 屏蔽 (no6) 对静态域名也生效
        if (type === 'AAAA' && config.no6 === 'true') {
            const isEnhanceActive = config.enhance === 'rule' || config.enhance === 'full';
            if (isEnhanceActive) {
                const ruleObj = await matchRule(domain, config);
                // 规则匹配且提供了 IPv6 或未屏蔽 AAAA → 放行
                if (ruleObj && (!ruleObj.noAAAA || ruleObj.ips.some(ip => ip.includes(':')))) {  
                } else {
                    return { domain, type, answers: [], ech: null };
                }
            } else {
                return { domain, type, answers: [], ech: null };
            }
     }
    // 增强模式规则屏蔽 / 指定 IP（对所有域名生效，包括静态域名）
    if (config.enhance === 'rule' || config.enhance === 'full') {
        const ruleObj = await matchRule(domain, config);
        if (ruleObj) {
            // 规则指定了对应类型的 IP → 直接返回规则 IP
            if (type === 'A' && ruleObj.ips.some(ip => !ip.includes(':'))) {
                let ips = ruleObj.ips.filter(ip => !ip.includes(':'));
                if (config.shuffle !== 'false') ips = shuffle(ips);
                return { domain, type, answers: ips, ech: null };
            }
            if (type === 'AAAA' && ruleObj.ips.some(ip => ip.includes(':'))) {
                let ips = ruleObj.ips.filter(ip => ip.includes(':'));
                if (config.shuffle !== 'false') ips = shuffle(ips);
                return { domain, type, answers: ips, ech: null };
            }
            // 规则要求屏蔽 → 直接返回空
            if (type === 'A' && ruleObj.noA) return { domain, type, answers: [], ech: null };
            if (type === 'AAAA' && ruleObj.noAAAA) return { domain, type, answers: [], ech: null };
        }
    }
    // 静态域名（含 best 提升）的优选 IP
    if (effectiveCF || effectiveMeta) {
        return handleStaticDomain(domain, type, config, effectiveCF, effectiveMeta, clientIP);
    }
    // 普通域名上游查询
    const dnsType = type === 'AAAA' ? 28 : 1;
    const data = await queryUpstreamDNS(domain, dnsType, clientIP);
    const answers = data?.Answer?.filter(r => r.type === dnsType).map(r => r.data) || [];
    return { domain, type, answers, ech: null };
    }
    // HTTPS 处理
    if (type === 'HTTPS') {
        // CF/Meta 域名
        if (owner === 'CF' || owner === 'META') {
            const usePreferredHints = isStaticCF || isStaticMeta || best;
            const result = await buildStaticHttpsRecord(domain, config, clientIP, owner === 'CF', owner === 'META', usePreferredHints);
            return cleanResult(result);
        }

        // 增强模式 (非CF/Meta)
        if (config.enhance && config.enhance !== 'off') {
            const result = await buildEnhancedHttpsRecord(domain, config, clientIP);
            return cleanResult(result);
        }
        // 默认返回上游原始 HTTPS 记录
        const data = await queryUpstreamDNS(domain, 65, clientIP);
        const result = { domain, type, answers: [] };
        if (data?.Answer) {
            const rec = data.Answer.find(r => r.type === 65);
            if (rec) {
                const parsed = parseHttpsRecordFull(rec.data);  
                if (parsed) {
                    result.ech = parsed.ech || null;
                    if (parsed.ipv4hints && parsed.ipv4hints.length > 0) result.ipv4hints = parsed.ipv4hints;
                    if (parsed.ipv6hints && parsed.ipv6hints.length > 0) result.ipv6hints = parsed.ipv6hints;
                    result.alpn = parsed.alpn || '';
                }
            }
        }
        return result;
    }
    // 通用兜底：CNAME、TXT、MX 等所有其他类型
    return await resolveFallbackRecord(domain, type, clientIP);
}

function cleanResult(result) {
    if (result.ipv4hints && result.ipv4hints.length === 0) delete result.ipv4hints;
    if (result.ipv6hints && result.ipv6hints.length === 0) delete result.ipv6hints;
    return result;
}

// ===================== 静态域名 A/AAAA 处理 =====================
async function handleStaticDomain(domain, type, config, isCF, isMeta, clientIP) {
    const doShuffle = config.shuffle !== 'false';
    let ips = [];
    
    // ----- AAAA 记录 -----
    if (type === 'AAAA') {
        if (isDomainIpv4Only(domain)) return { domain, type, answers: [], ech: null };

        if (isMeta) {
            ips = config.metaIp6 ? parseIpList(config.metaIp6, doShuffle) : [];
        } else {
            // CF
            if (config.ip6) ips = parseIpList(config.ip6, doShuffle);
            else if (config.cfDomain) {
                const resolved = await resolveMultiDomainToIps(config.cfDomain, 28, clientIP, doShuffle, MAX_PRESCREEN);
                if (resolved.length > 0) ips = resolved.map(formatIPv6FromBytes);
            } else ips = parseIpList(DEFAULT_CF_IP6, doShuffle);
        }
    }

    // ----- A 记录 -----
    if (type === 'A') {
        if (isCF) {
            if (config.ip4) ips = parseIpList(config.ip4, doShuffle);
            else if (config.cfDomain) {
                const resolved = await resolveMultiDomainToIps(config.cfDomain, 1, clientIP, doShuffle, MAX_PRESCREEN);
                if (resolved.length > 0) ips = resolved.map(bytesToIp);
            } else ips = parseIpList(DEFAULT_CF_IP, doShuffle);
        } else {
            // Meta
            if (config.metaIp4) ips = parseIpList(config.metaIp4, doShuffle);
            else if (config.metaDomain) {
                const resolved = await resolveMultiDomainToIps(config.metaDomain, 1, clientIP, doShuffle, MAX_PRESCREEN);
                if (resolved.length > 0) ips = resolved.map(bytesToIp);
            } else ips = parseIpList(DEFAULT_META_IP, doShuffle);
        }
    }

    // ----- 通用安全兜底：如果最终 IP 列表为空且未被屏蔽，从上游获取真实记录 -----
    if (ips.length === 0) {
        const ruleObj = (config.enhance === 'rule' || config.enhance === 'full')
            ? await matchRule(domain, config)
            : null;
        if (!isTypeBlocked(type, ruleObj, config, isCF)) {
            const dnsType = type === 'AAAA' ? 28 : 1;
            const real = await resolveRealHints(domain, dnsType, clientIP);
            if (real.length > 0) {
                ips = real;
                if (doShuffle) ips = shuffle(ips);
            }
        }
    }
    if(ips.length > MAX_FINAL){
        if(doShuffle) ips = shuffle([...ips]);
        ips = ips.slice(0, MAX_FINAL);
    }
    return { domain, type, answers: ips, ech: null };
}
// ===================== CN域名处理 =====================
async function handleCNDomain(domain, type, config, clientIP) {
    // 获取增强规则对象（仅增强模式开启时）
    const ruleObj = (config.enhance === 'rule' || config.enhance === 'full')
        ? await matchRule(domain, config)
        : null;

    // 1. 检查屏蔽（复用 isTypeBlocked）
    if (isTypeBlocked(type, ruleObj, config, false)) {
        return { domain, type, answers: [], ech: null };
    }

    // 2. 规则提供了对应类型的 IP → 直接返回规则 IP
    if (ruleObj) {
        if (type === 'A' && ruleObj.ips.some(ip => !ip.includes(':'))) {
            let ips = ruleObj.ips.filter(ip => !ip.includes(':'));
            if (config.shuffle !== 'false') ips = shuffle(ips);
            return { domain, type, answers: ips, ech: null };
        }
        if (type === 'AAAA' && ruleObj.ips.some(ip => ip.includes(':'))) {
            let ips = ruleObj.ips.filter(ip => ip.includes(':'));
            if (config.shuffle !== 'false') ips = shuffle(ips);
            return { domain, type, answers: ips, ech: null };
        }
    }

    // 3. 未匹配规则或无IP，走国内兜底（查询上游返回原始记录）
    return await resolveFallbackRecord(domain, type, clientIP, UPSTREAM_CN_JSON);
}

//=====================公共 HTTPS 记录构建函数=====================    
async function buildHttpsRecord(domain, config, clientIP, options = {}) {
    const {
        isCF = false,
        isMeta = false,
        usePreferredHints = true,
        injectECH = false,
        injectEnhance = false
    } = options;

    const alpn = config.alpn || 'h3,h2';
    const owner = isCF ? 'CF' : (isMeta ? 'META' : null);
    const mode = config.enhance || 'off';
    const ruleObj = (mode === 'rule' || mode === 'full') ? await matchRule(domain, config) : null;

    let ipv4 = [], ipv6 = [];

    // 1. 收集 hints
    if (ruleObj) {
        if (ruleObj.ips.length > 0) {
            ipv4 = ruleObj.ips.filter(ip => !ip.includes(':'));
            ipv6 = ruleObj.ips.filter(ip => ip.includes(':'));
        } else if (owner) {
            const source = usePreferredHints ? 'preferred' : 'real';
            const hints = await collectIpHints(domain, config, clientIP, owner, source);
            ipv4 = hints.ipv4;
            ipv6 = hints.ipv6;
        }
    } else if (owner) {
        const source = usePreferredHints ? 'preferred' : 'real';
        const hints = await collectIpHints(domain, config, clientIP, owner, source);
        ipv4 = hints.ipv4;
        ipv6 = hints.ipv6;
    } else {
        const hints = await collectIpHints(domain, config, clientIP, null, mode);
        ipv4 = hints.ipv4;
        ipv6 = hints.ipv6;
    }

    // 2. 应用屏蔽标志（包括 nocf6）
    if (isTypeBlocked('A', ruleObj, config, isCF)) ipv4 = [];
    if (isTypeBlocked('AAAA', ruleObj, config, isCF)) ipv6 = [];

    // 3. 安全兜底
    if (ipv4.length === 0 && !isTypeBlocked('A', ruleObj, config, isCF)) {
        ipv4 = await resolveRealHints(domain, 1, clientIP);
    }
    if (ipv6.length === 0 && !isTypeBlocked('AAAA', ruleObj, config, isCF)) {
        ipv6 = await resolveRealHints(domain, 28, clientIP);
    }

    // 4. 构建参数表
    const paramMap = new Map();

    if (!owner || injectEnhance) {
        try {
            const data = await queryUpstreamDNS(domain, 65, clientIP);
            if (data?.Answer) {
                const rec = data.Answer.find(r => r.type === 65);
                if (rec) {
                    const upstreamParams = parseRawHttpsRecord(rec.data);
                    for (const p of upstreamParams) {
                        if (p.key && p.val !== undefined) paramMap.set(p.key, p.val);
                    }
                }
            }
        } catch (e) {}
    }

    // 5. 注入 ECH
    if (injectECH && owner) {
        const ech = isCF
            ? await fetchRealEch(config.echDomain || 'cloudflare-ech.com', clientIP)
            : META_ECH_CONFIG;
        if (ech) paramMap.set('ech', ech);
    }

    // 6. 设置 ALPN 与 hints（仅非空时写入）
    paramMap.set('alpn', alpn);
    if (ipv4.length > 0) paramMap.set('ipv4hint', ipv4.join(','));
    else paramMap.delete('ipv4hint');
    if (ipv6.length > 0) paramMap.set('ipv6hint', ipv6.join(','));
    else paramMap.delete('ipv6hint');

    // 7. 注入增强默认参数
    const finalParams = Array.from(paramMap, ([k, v]) => ({ key: k, val: v }));
    if (injectEnhance) {
        injectEnhanceDefaults(finalParams, config.mandatory || 'alpn');
    }

    return buildHttpsRecordFromParams(domain, finalParams, ipv4, ipv6);
}

// ===================== HTTPS 记录构建 (CF/Meta) =====================
async function buildStaticHttpsRecord(domain, config, clientIP, isCF, isMeta, usePreferredHints) {
    return buildHttpsRecord(domain, config, clientIP, {
        isCF,
        isMeta,
        usePreferredHints,
        injectECH: true,
        injectEnhance: false
    });
}

// ===================== HTTPS 记录增强构建(非CF/Meta) =====================
async function buildEnhancedHttpsRecord(domain, config, clientIP) {
    return buildHttpsRecord(domain, config, clientIP, {
        injectECH: false,
        injectEnhance: true
    });
}

// ===================== 统一 IP hints 收集 =====================
async function collectIpHints(domain, config, clientIP, owner, source) {
    let ipv4 = [], ipv6 = [];

    // 规则匹配 (rule/full 优先)
    if (source === 'rule' || source === 'full') {
        const ruleObj = await matchRule(domain, config);
        if (ruleObj !== null) {
            const matchedIPs = ruleObj.ips;
            ipv4 = matchedIPs.filter(ip => !ip.includes(':'));
            ipv6 = matchedIPs.filter(ip => ip.includes(':'));
            // 匹配到域名但 IP 为空时从上游获取
            if (ipv4.length === 0 && ipv6.length === 0) {
                [ipv4, ipv6] = await Promise.all([
                    resolveRealHints(domain, 1, clientIP),   // 在第二部分
                    resolveRealHints(domain, 28, clientIP)
                ]);
            }
        }
    }

    // 优选 IP (preferred)
    if (source === 'preferred') {
        if (owner === 'CF') {
            ipv4 = config.ip4 ? parseIpList(config.ip4, false) :
                config.cfDomain ? (await resolveMultiDomainToIps(config.cfDomain, 1, clientIP, false, MAX_PRESCREEN)).map(bytesToIp) :
                parseIpList(DEFAULT_CF_IP, false);
            ipv6 = !isDomainIpv4Only(domain) ?
                (config.ip6 ? parseIpList(config.ip6, false) :
                config.cfDomain ? (await resolveMultiDomainToIps(config.cfDomain, 28, clientIP, false, MAX_PRESCREEN)).map(formatIPv6FromBytes) :
                parseIpList(DEFAULT_CF_IP6, false)) : [];
        } else {
            ipv4 = config.metaIp4 ? parseIpList(config.metaIp4, false) :
                config.metaDomain ? (await resolveMultiDomainToIps(config.metaDomain, 1, clientIP, false, MAX_PRESCREEN)).map(bytesToIp) :
                parseIpList(DEFAULT_META_IP, false);
            ipv6 = config.metaIp6 ? parseIpList(config.metaIp6, false) :
                config.metaDomain ? (await resolveMultiDomainToIps(config.metaDomain, 28, clientIP, false, MAX_PRESCREEN)).map(formatIPv6FromBytes) : [];
        }
    }

    // 真实 IP (real / full 且未匹配)
    if ((source === 'real' || source === 'full') && ipv4.length === 0 && ipv6.length === 0) {
        [ipv4, ipv6] = await Promise.all([
            resolveRealHints(domain, 1, clientIP),
            resolveRealHints(domain, 28, clientIP)
        ]);
    }

    ipv4 = [...new Set(ipv4)].slice(0, MAX_FINAL);
    ipv6 = [...new Set(ipv6)].slice(0, MAX_FINAL);
    if (config.shuffle !== 'false') {
        ipv4 = shuffle(ipv4);   
        ipv6 = shuffle(ipv6);
    }
    return { ipv4, ipv6 };
}
// ===================== 规则匹配 =====================

let builtinRulesMap = null;

async function getBuiltinRulesMap() {
    if (builtinRulesMap) return builtinRulesMap;

    const map = new Map();
    const hints = BUILTIN_HINTS;
    if (Array.isArray(hints)) {
        // 第一遍：处理 hosts 条目，生成基础规则
        for (const group of hints) {
            if (group.hosts && Array.isArray(group.hosts)) {
                const noA = group.noA || false;
                const noAAAA = group.noAAAA || false;
                const hostIpsMap = new Map();
                for (const url of group.hosts) {
                    let data = null;
                    const cacheKey = `https://dns-cache/hosts/${encodeURIComponent(url)}`;
                    const cached = hostsCache.get(url);

                    // 1. 内存缓存命中
                    if (cached && Date.now() < cached.expire) {
                        data = cached.data;
                    } else {
                        // 2. Cache API 读取（新增）
                        const cachedText = await readCache(cacheKey);
                        if (cachedText) {
                            try {
                                data = JSON.parse(cachedText);
                                hostsCache.set(url, { data, expire: Date.now() + HOSTS_CACHE_TTL });
                            } catch (e) {
                                data = null;
                            }
                        }    
                        // 3. Cache API 未命中，远程下载（原逻辑）
                        if (!data) {
                            try {
                                const controller = new AbortController();
                                const timer = setTimeout(() => controller.abort(), 5000);
                                const res = await fetch(url, { signal: controller.signal });
                                clearTimeout(timer);
                                if (res.ok) {
                                    data = await res.json();
                                    // 写入内存缓存
                                    hostsCache.set(url, {
                                        data: data,
                                        expire: Date.now() + HOSTS_CACHE_TTL
                                    });
                                    // 异步写入 Cache API（新增）
                                    writeCache(cacheKey, JSON.stringify(data), HOSTS_CACHE_TTL / 1000);
                                } else if (cached) {
                                    // 下载失败，使用过期内存缓存
                                    data = cached.data;
                                }
                            } catch (e) {
                                console.error('Fetch hosts error:', url, e);
                                if (cached) data = cached.data;
                            }
                        }
                    }

                    if (data && Array.isArray(data)) {
                        for (const entry of data) {
                            let domain, ip;
                            if (typeof entry === 'object' && !Array.isArray(entry)) {
                                domain = entry.domain || entry.host || '';
                                ip = entry.ip || entry.addr || '';
                            } else if (Array.isArray(entry) && entry.length >= 2) {
                                ip = entry[0];
                                domain = entry[1];
                            }
                            if (domain && ip) {
                                if (!hostIpsMap.has(domain)) hostIpsMap.set(domain, new Set());
                                hostIpsMap.get(domain).add(ip);
                            }
                        }
                    }
                }

                for (const [domain, ipSet] of hostIpsMap.entries()) {
                    const ips = Array.from(ipSet);
                    map.set(domain, { ips, noA, noAAAA });
                }
            }
        }

        // 第二遍：处理普通条目（可覆盖 hosts 生成的规则）
        for (const group of hints) {
            if (group.domains && Array.isArray(group.domains)) {
                const { ips = [], noA = false, noAAAA = false } = group;
                const ruleObj = { ips, noA, noAAAA };
                for (const d of group.domains) {
                    map.set(d, ruleObj);
                }
            }
        }
    } else {
        for (const [domain, val] of Object.entries(hints)) {
            map.set(domain, {
                ips: Array.isArray(val) ? val : (val.ips || []),
                noA: val.noA || false,
                noAAAA: val.noAAAA || false
            });
        }
    }
    builtinRulesMap = map;
    return map;
}

async function matchRule(domain, config) {
   
    const merged = new Map(await getBuiltinRulesMap());
    for(const[key,rule] of merged){  rule.ips = rule.ips.flatMap(ip => ip.includes('/') ? getPrefixIPs(ip) : [ip]); }
    if (config.rules) {
        const user = parseRules(config.rules);
        for (const [k, v] of user) merged.set(k, v);
    }
    const matched = [];
    for (const [pattern, ruleObj] of merged) {
        if (matchDomainPattern(domain, pattern)) {
            matched.push({ pattern, ruleObj });
        }
    }
    if (matched.length === 0) return null;
    matched.sort((a, b) => b.pattern.length - a.pattern.length);
    return matched[0].ruleObj;
}

function matchDomainPattern(domain, pattern) {
    if (pattern.startsWith('*.')) {
        const suffix = pattern.substring(1);
        return domain.endsWith(suffix) || domain === suffix.substring(1);
    }
    return domain === pattern;
}

function parseRules(rulesStr) {
    const map = new Map();
    if (!rulesStr) return map;
    const entries = rulesStr.split(';');
    for (const entry of entries) {
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) continue;
        const patternPart = entry.substring(0, colonIdx).trim();    // 可能是 "*.google.com" 或 "*.google.com,google.com"
        const rest = entry.substring(colonIdx + 1).trim();

        const dashIdx = rest.indexOf('-');
        let ips = [];
        let flags = new Set();

        if (dashIdx === -1) {
            ips = rest.split(',').map(s => s.trim()).filter(s => s);
            ips = ips.flatMap(ip => ip.includes('/') ? getPrefixIPs(ip) : [ip]); 
        } else {
            const ipPart = rest.substring(0, dashIdx).trim();
            const flagPart = rest.substring(dashIdx + 1).trim();
            if (ipPart) {
                ips = ipPart.split(',').map(s => s.trim()).filter(s => s);
                ips = ips.flatMap(ip => ip.includes('/') ? getPrefixIPs(ip) : [ip]); 
            }
            if (flagPart) {
                flagPart.split('-').map(s => s.trim().toLowerCase()).forEach(f => {
                    if (f === 'noa' || f === 'noaaaa') flags.add(f);
                });
            }
        }

        const ruleObj = { ips, noA: flags.has('noa'), noAAAA: flags.has('noaaaa') };

        // 处理多域名：用逗号分隔，每个域名都对应同样的规则
        const patterns = patternPart.split(',').map(s => s.trim()).filter(s => s);
        for (const pattern of patterns) {
            map.set(pattern, ruleObj);
        }
    }
    return map;
}

// ===================== HTTPS 记录打包 =====================
function buildHttpsRecordFromParams(domain, params, ipv4Hints, ipv6Hints) {
    const finalParams = sortAndDedupeParams([...params], ipv4Hints, ipv6Hints);
    const httpsRecord = packHttpsParams(1, ".", finalParams);   // packHttpsParams 在第二部分
    const result = { domain, type: 'HTTPS', answers: [] };
    result.ech = finalParams.find(p => p.key === 'ech')?.val || null;
    result.httpsRecord = httpsRecord;
    if (ipv4Hints.length) result.ipv4hints = ipv4Hints;
    if (ipv6Hints.length) result.ipv6hints = ipv6Hints;
    return result;
}

function sortAndDedupeParams(params, ipv4Hints, ipv6Hints) {
    const keyOrder = {
        mandatory: SVC_PARAM_IDS.mandatory,
        alpn: SVC_PARAM_IDS.alpn,
        "no-default-alpn": SVC_PARAM_IDS["no-default-alpn"],
        port: SVC_PARAM_IDS.port,
        ipv4hint: SVC_PARAM_IDS.ipv4hint,
        ech: SVC_PARAM_IDS.ech,
        ipv6hint: SVC_PARAM_IDS.ipv6hint
    };
    const map = new Map();
    const booleanKeys = new Set(['no-default-alpn']);

    for (const p of params) {
        if (p.key && p.val !== undefined) {
            if (p.val !== '' || booleanKeys.has(p.key)) {
                map.set(p.key, p.val);
            }
        }
    }

    if (ipv4Hints.length > 0) map.set('ipv4hint', ipv4Hints.join(','));
    else map.delete('ipv4hint');
    if (ipv6Hints.length > 0) map.set('ipv6hint', ipv6Hints.join(','));
    else map.delete('ipv6hint');

    const sortedKeys = Array.from(map.keys()).sort(
        (a, b) => (keyOrder[a] ?? 999) - (keyOrder[b] ?? 999)
    );
    return sortedKeys.map(k => ({ key: k, val: map.get(k) }));
}

// ===================== 假名 ECH 响应 =====================
async function buildFakeEchResponse(config, domain, clientIP, isCF) {
    const owner = isCF ? 'CF' : 'META';
    const { ipv4, ipv6 } = await collectIpHints(domain, config, clientIP, owner, 'preferred');
    const params = [
        { key: 'alpn', val: config.alpn || 'h3,h2' },
        { key: 'ech', val: isCF ? (await fetchRealEch(config.echDomain || 'cloudflare-ech.com', clientIP) || '') : META_ECH_CONFIG }
    ];
    return buildHttpsRecordFromParams(domain, params, ipv4, ipv6).httpsRecord;
}

// ===================== 第二部分：工具函数 =====================
/**
 * IP 列表解析（支持逗号分隔或 JSON 数组）
 * @param {string} raw - 原始字符串
 * @param {boolean} doShuffle - 是否随机乱序（默认 true）
 * @returns {string[]} IP 数组
 */
function parseIpList(raw, doShuffle = true) {
    if (!raw) return [];
    raw = raw.trim();
    let arr;
    if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
            arr = JSON.parse(raw).map(String).filter(s => s);
        } catch {
            arr = raw.split(',').map(s => s.trim()).filter(s => s);
        }
    } else {
        arr = raw.split(',').map(s => s.trim()).filter(s => s);
    }
    if (doShuffle) return shuffle(arr);
    return arr;
}
/**
 * cacheAPI R&W
 */
async function readCache(cacheKey) {
    try {
        const res = await caches.default.match(cacheKey);
        if (res) return await res.text();
    } catch (e) {}
    return null;
}
async function writeCache(cacheKey, text, ttlSeconds) {
    try {
        const response = new Response(text, {
            headers: { 'Cache-Control': `public, max-age=${ttlSeconds}` }
        });
        await caches.default.put(cacheKey, response);
    } catch (e) {}
}

/**
 * 记录预筛选函数
 */
function prescreenIpList(raw) {
    if (!raw) return '';
    const ips = raw.split(',').map(s => s.trim()).filter(s => s);
    if (ips.length <= MAX_PRESCREEN) return raw;
    const shuffled = shuffle([...ips]);
    return shuffled.slice(0, MAX_PRESCREEN).join(',');
}
/**
 * HTTPS RR 注入参数
 */
function injectEnhanceDefaults(params, mandatoryValue) {
    const existingKeys = new Set(params.map(p => p.key));
    if (!existingKeys.has('mandatory')) params.push({ key: 'mandatory', val: mandatoryValue || 'alpn' });
  //  if (!existingKeys.has('no-default-alpn')) params.push({ key: 'no-default-alpn', val: '' });
}

/**
 * 日志系统
 */
async function handleLogsRequest() {
    try {
        await ensureCNDomainSet();
        const now = Date.now();

        // 辅助：毫秒时间戳 → 东八区 ISO 字符串
        const toBeijingTime = (ts) => {
            if (!ts) return null;
            const d = new Date(ts);
            const offset = 8 * 60; // 东八区偏移分钟数
            const local = new Date(d.getTime() + offset * 60 * 1000);
            return local.toISOString().replace('Z', '+08:00');
        };

        // ==================== Worker 运行信息 ====================
        // 使用顶层常量 workerStartTime，若未初始化则用当前时间兜底
        const startTime = globalThis_workerStartTime;
        const uptimeMs = now - startTime;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

        const runtime = {
            _description: 'Worker 运行信息',
            uptime: uptimeFormatted,
            startedAt: toBeijingTime(startTime),
        };

        // ==================== 国内域名列表 (CN List) ====================
        const cnList = {
            _description: '国内域名列表加载状态',
            domainCount: cnDomainSet ? cnDomainSet.size : 0,
            lastFetch: cnDomainLastFetch ? toBeijingTime(cnDomainLastFetch) : null,
            nextFetchIn: cnDomainLastFetch
                ? Math.max(0, CN_DOMAIN_CACHE_TTL - (now - cnDomainLastFetch)) / 1000 + 's'
                : 'expired',
            sourceUrl: CN_DOMAIN_LIST_URL,
            ttl: CN_DOMAIN_CACHE_TTL / 1000 / 3600 + '小时',
        };

        // ==================== 缓存状态 ====================
        const echKey = 'ech:cloudflare-ech.com';
        const cacheStatus = {
            _description: '内存 & Cache API 双重缓存状态',
            memory: {
                echCache: cacheMap.has(echKey) ? '已预热 (warm)' : '未预热 (cold)',
                ownerCacheSize: cacheMap.size,
                subCacheCount: subCache.size,
                hostsCacheCount: hostsCache.size,
                prefixCacheCount: prefixCache.size,
            },
            edgeCache: {
                ech: cacheMap.has(echKey) ? '已缓存 (cached)' : '未缓存 (empty)',
                sub: subCache.size > 0 ? '已缓存 (cached)' : '未缓存 (empty)',
                cn: cnDomainSet && cnDomainSet.size > 1000 ? '已缓存 (cached)' : '未缓存 (empty)',
                hosts: hostsCache.size > 0 ? '已缓存 (cached)' : '未缓存 (empty)',
            }
        };

        // 订阅缓存详情
        const subDetails = [];
        for (const [url, entry] of subCache.entries()) {
            subDetails.push({
                url: url,
                cachedAt: toBeijingTime(entry.expire - SUB_CACHE_TTL),
                expiresIn: Math.max(0, (entry.expire - now) / 1000).toFixed(0) + 's',
                contentLength: entry.content ? entry.content.length : 0,
            });
        }

        // ==================== 组装最终响应 ====================
        const payload = {
            timestamp: toBeijingTime(now),
            runtime: runtime,
            cnList: cnList,
            caches: cacheStatus,
            subCache: subDetails,
        };

        return json(payload);
    } catch (e) {
        // 捕获异常并返回错误信息，方便定位
        return json({
            error: e.message,
            stack: e.stack,
            note: 'Check top-level constants: workerStartTime, hostsCache, prefixCache, cnDomainSet, etc.'
        }, 500);
    }
}
/**
 * Fisher-Yates 洗牌算法
 */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 多域名并发解析 IP，支持洗牌
 */
async function resolveMultiDomainToIps(domainsStr, type, clientIP, doShuffle = true, limit = 0) {
    const domains = domainsStr.split(',').map(s => s.trim()).filter(s => s);
    if (domains.length === 0) return [];
    const promises = domains.map(d => resolveDomainToIp(d, type, clientIP));
    const results = await Promise.allSettled(promises);
    const allIps = new Set();
    for (const res of results) {
        if (res.status === 'fulfilled') {
            for (const ip of res.value) allIps.add(ip);
        }
    }
    let ipArray = Array.from(allIps);
    if (doShuffle) shuffle(ipArray);
    if(limit >0 && ipArray.length > limit){
        ipArray = ipArray.slice(0,limit);
    }
    if (type === 1) return ipArray.map(ipToBytes);
    else return ipArray.map(ipv6ToBytes);
}

/**
 * 解析单个域名的指定类型记录
 */
async function resolveDomainToIp(domain, type = 1, clientIP) {
    const data = await queryUpstreamDNS(domain, type, clientIP);
    if (data && data.Answer) {
        return data.Answer.filter(r => r.type === type).map(r => r.data);
    }
    return [];
}

/**
 * 上游 DNS 查询（带 ECS 支持与 Edge 缓存）
 */
async function queryUpstreamDNS(name, type, clientIP = '',upstreamUrl = null) {
    const params = new URLSearchParams({ name, type: String(type) });
    let ecsCacheSuffix = '';
    if (clientIP) {
        if (clientIP.includes(':')) {
            const prefix = clientIP.split(':').slice(0, 4).join(':') + '::/56';
            params.set('edns_client_subnet', clientIP + '/56');
            ecsCacheSuffix = '/56-' + prefix;
        } else {
            const parts = clientIP.split('.');
            const prefix = parts.slice(0, 3).join('.') + '.0/24';
            params.set('edns_client_subnet', clientIP + '/24');
            ecsCacheSuffix = '/24-' + prefix;
        }
    }

    const cacheKey = new Request(`https://dns-cache/${encodeURIComponent(name)}/${type}${ecsCacheSuffix}`);
    try {
        if (typeof caches !== 'undefined' && caches.default) {
            const cachedRes = await caches.default.match(cacheKey);
            if (cachedRes) return cachedRes.json();
        }
    } catch (e) {}

       // 上游 URL 列表：国内域名仅阿里，国外域名保持 Google + 您的自定义 DNS 竞速
    const urls = upstreamUrl
        ? [upstreamUrl + '?' + params.toString()]
        : [UPSTREAM_JSON_GOOGLE + '?' + params.toString(), UPSTREAM_JSON_CUSTOM + '?' + params.toString()]; 
    const promises = urls.map(url =>
        fetch(url, { headers: { 'Accept': 'application/dns-json' } })
            .then(res => res.ok ? res.json() : Promise.reject())
    );

    let result;
    try {
        result = await Promise.any(promises);
    } catch {
        try {
            const res = await fetch(urls[0], { headers: { 'Accept': 'application/dns-json' } });
            if (res.ok) result = await res.json();
            else return null;
        } catch { return null; }
    }

    if (result && typeof caches !== 'undefined' && caches.default) {
        try {
            const maxAge = (type === 65) ? 600 : 300;
            const resToCache = new Response(JSON.stringify(result), {
                headers: { 'Cache-Control': `public, max-age=${maxAge}` }
            });
            caches.default.put(cacheKey, resToCache).catch(() => {});
        } catch (e) {}
    }
    return result;
}

/**
 * 获取 Cloudflare ECH 公钥（带内存缓存）
 */
async function fetchRealEch(echDomain, clientIP) {
    const cacheKey = `ech:${echDomain}`;
    const cacheUrl = `https://dns-cache/${cacheKey}`;
    // 1. 内存缓存
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expire) return cached.value;
    // 2. Cache API（新增）
    try {
        const cachedText = await readCache(cacheUrl);
        if (cachedText) {
            const data = JSON.parse(cachedText);
            if (data && data.ech) {
                cacheMap.set(cacheKey, { value: data.ech, expire: Date.now() + ECH_CACHE_TTL });
                return data.ech;
            }
        }
    } catch (e) {}
    // 3. 上游查询（原有逻辑）
    try {
        let data = await queryUpstreamDNS(echDomain, 65, clientIP);
        if (!data) {
            await new Promise(r => setTimeout(r, 500));
            data = await queryUpstreamDNS(echDomain, 65, clientIP);
        }
        if (data && data.Answer) {
            const rec = data.Answer.find(r => r.type === 65);
            if (rec) {
                const parsed = parseHttpsRecord(rec.data);
                if (parsed && parsed.ech) {
                    cacheMap.set(cacheKey, { value: parsed.ech, expire: Date.now() + ECH_CACHE_TTL });
                    // 异步写入 Cache API（新增）
                    writeCache(cacheUrl, JSON.stringify({ ech: parsed.ech }), ECH_CACHE_TTL / 1000);
                    return parsed.ech;
                }
            }
        }
    } catch {}
    return null;
}

/**
 * 简单解析 HTTPS 记录，提取 ech 字段
 */
function parseHttpsRecord(dataStr) {
    const parts = dataStr.split(/\s+/);
    if (parts.length < 3) return null;
    const result = {};
    for (let i = 2; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (k === 'ech') result.ech = v;
        else if (k === 'alpn') result.alpn = v;
    }
    return result;
}

/**
 * 打包 HTTPS 记录（包含 hints）
 */
function packHttpsParamsWithHints(priority, target, params, ipv4Hints, ipv6Hints) {
    if (ipv4Hints && ipv4Hints.length > 0) {
        const unique = [...new Set(ipv4Hints)].slice(0, MAX_FINAL);
        if (unique.length > 0) params.push({ key: 'ipv4hint', val: unique.join(',') });
    }
    if (ipv6Hints && ipv6Hints.length > 0) {
        const unique = [...new Set(ipv6Hints)].slice(0, MAX_FINAL);
        if (unique.length > 0) params.push({ key: 'ipv6hint', val: unique.join(',') });
    }
    return packHttpsParams(priority, target, params);
}

/**
 * 打包 HTTPS 记录（内部使用）
 */
function packHttpsParams(priority, target, params) {
    const targetBuf = target === "." ? new Uint8Array([0]) : encodeDnsName(target);
    const paramBufs = params.map(p => encodeSvcParam(p.key, p.val)).filter(b => b);
    paramBufs.sort((a, b) => new DataView(a.buffer).getUint16(0) - new DataView(b.buffer).getUint16(0));
    let totalLen = 2 + targetBuf.length;
    for (const b of paramBufs) totalLen += b.length;
    const res = new Uint8Array(totalLen);
    const v = new DataView(res.buffer);
    v.setUint16(0, priority);
    res.set(targetBuf, 2);
    let offset = 2 + targetBuf.length;
    for (const b of paramBufs) { res.set(b, offset); offset += b.length; }
    return res;
}

/**
 * 编码 SVCB 参数
 */
function encodeSvcParam(key, value) {
    const id = SVC_PARAM_IDS[key];
    if (id === undefined) return null;
    let valBuf;

    // mandatory：排序、去重、安全处理
    if (key === 'mandatory') {
        const keys = [...new Set(
            value.split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(k => SVC_PARAM_IDS[k])
                .filter(v => v !== undefined)
        )].sort((a, b) => a - b);

        if (keys.length === 0) return null;
        valBuf = new Uint8Array(keys.length * 2);
        const dv = new DataView(valBuf.buffer);
        keys.forEach((id, i) => dv.setUint16(i * 2, id));
    }
    // no-default-alpn：空值
    else if (key === 'no-default-alpn') {
        valBuf = new Uint8Array(0);
    }
    // alpn：字符串列表编码，增加长度限制
    else if (key === 'alpn') {
        const parts = value.split(',').map(s => s.trim()).filter(s => s);
        if (parts.length === 0) return null;
        for (const p of parts) {
            if (p.length > 255) return null; // 标识长度不得超过 255 字节
        }
        valBuf = new Uint8Array(parts.reduce((a, b) => a + b.length + 1, 0));
        let o = 0;
        for (const p of parts) {
            valBuf[o++] = p.length;
            for (let i = 0; i < p.length; i++) valBuf[o++] = p.charCodeAt(i);
        }
    }
    // port：严格校验
    else if (key === 'port') {
        const portNum = Number(value);
        if (!Number.isInteger(portNum) || portNum < 0 || portNum > 65535) return null;
        valBuf = new Uint8Array(2);
        new DataView(valBuf.buffer).setUint16(0, portNum);
    }
    // ipv4hint
    else if (key === 'ipv4hint') {
        const parts = value.split(',').map(s => s.trim()).filter(s => s);
        if (parts.length === 0) return null;
        valBuf = new Uint8Array(parts.length * 4);
        let offset = 0;
        for (const ip of parts) {
            const bytes = ipToBytes(ip);
            if (!bytes) return null;
            valBuf.set(bytes, offset);
            offset += 4;
        }
    }
    // ipv6hint
    else if (key === 'ipv6hint') {
        const parts = value.split(',').map(s => s.trim()).filter(s => s);
        if (parts.length === 0) return null;
        valBuf = new Uint8Array(parts.length * 16);
        let offset = 0;
        for (const ip of parts) {
            const bytes = ipv6ToBytes(ip);
            if (!bytes) return null;
            valBuf.set(bytes, offset);
            offset += 16;
        }
    }
    // ech 等 Base64URL 字段，增加填充处理
    else {
        try {
            let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';   // 补齐 padding
            const s = atob(b64);
            valBuf = new Uint8Array(s.length);
            for (let i = 0; i < s.length; i++) valBuf[i] = s.charCodeAt(i);
        } catch (e) {
            console.error('encodeSvcParam base64 error:', e);
            return null;
        }
    }

    const res = new Uint8Array(4 + valBuf.length);
    const dv = new DataView(res.buffer);
    dv.setUint16(0, id);
    dv.setUint16(2, valBuf.length);
    res.set(valBuf, 4);
    return res;
}
/**
 * 域名编码为 DNS 标签格式
 */
function encodeDnsName(domain) {
    const parts = domain.split('.');
    const buf = new Uint8Array(domain.length + 2);
    let offset = 0;
    for (const part of parts) {
        buf[offset++] = part.length;
        for (let i = 0; i < part.length; i++) buf[offset++] = part.charCodeAt(i);
    }
    buf[offset++] = 0;
    return buf.slice(0, offset);
}

/**
 * 解析 DNS 报文头部与问题域
 */
function parseDnsPacket(buf) {
    const v = new DataView(buf);
    if (buf.byteLength < 12) return null;
    let offset = 12;
    const labels = [];
    while (offset < buf.byteLength) {
        const len = v.getUint8(offset);
        if (len === 0) { offset++; break; }
        if ((len & 0xC0) === 0xC0) { offset += 2; break; }
        offset++;
        labels.push(new TextDecoder().decode(buf.slice(offset, offset + len)));
        offset += len;
    }
    return {
        id: v.getUint16(0),
        questions: [{ name: labels.join('.'), type: v.getUint16(offset) }]
    };
}

/**
 * 构造多答案 DNS 响应报文
 */
function createMultiAnsResponse(id, qn, qt, rds, ttl = 3600) {
    const encodedName = encodeDnsName(qn);
    const questionLen = 12 + encodedName.length + 4;
    const pointer = 0xC000 | 12;
    let totalLen = questionLen;
    for (const r of rds) totalLen += 2 + 2 + 2 + 4 + 2 + r.length;
    const buf = new Uint8Array(totalLen);
    const v = new DataView(buf.buffer);
    v.setUint16(0, id);
    v.setUint16(2, 0x8180);
    v.setUint16(4, 1);
    v.setUint16(6, rds.length);
    v.setUint16(8, 0);
    v.setUint16(10, 0);
    let offset = 12;
    buf.set(encodedName, offset); offset += encodedName.length;
    v.setUint16(offset, qt); offset += 2;
    v.setUint16(offset, 1);  offset += 2;
    for (const r of rds) {
        v.setUint16(offset, pointer); offset += 2;
        v.setUint16(offset, qt); offset += 2;
        v.setUint16(offset, 1); offset += 2;
        v.setUint32(offset, ttl); offset += 4;
        v.setUint16(offset, r.length); offset += 2;
        buf.set(r, offset); offset += r.length;
    }
    return buf.buffer;
}

/**
 * 转发二进制 DNS 查询（双上游竞速）
 */
async function forwardQuery(body) {
    const reqInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/dns-message', 'Accept': 'application/dns-message' },
        body
    };
    const pGoogle = fetch(UPSTREAM_DNS_GOOGLE, reqInit).then(res => res.ok ? res : Promise.reject());
    const pAli = fetch(UPSTREAM_DNS_CUSTOM, reqInit).then(res => res.ok ? res : Promise.reject());
    try { return await Promise.any([pGoogle, pAli]); } catch { return fetch(UPSTREAM_DNS_GOOGLE, reqInit); }
}

/**
 * 返回二进制 DNS 响应
 */
function dnsResponse(buffer) {
    return new Response(buffer, {
        headers: { 'Content-Type': 'application/dns-message', 'Access-Control-Allow-Origin': '*' }
    });
}
/**
 * 兜底记录解析：直接查询上游并返回原始答案。
 * 适用于所有非 A/AAAA/HTTPS 类型，也可用于 HTTPS 类型的通用解析。
 */
async function resolveFallbackRecord(domain, type, clientIP, upstreamUrl = null) {
    const typeMap = {
        'A': 1,
        'AAAA': 28,
        'CNAME': 5,
        'TXT': 16,
        'MX': 15,
        'NS': 2,
        'HTTPS': 65
    };
    const dnsType = typeMap[type] || 1;

    const data = await queryUpstreamDNS(domain, dnsType, clientIP, upstreamUrl);
    if (!data) return { domain, type, error: '上游查询失败' };

    if (type === 'HTTPS') {
        const result = { domain, type, answers: [] };
        if (data?.Answer) {
            const rec = data.Answer.find(r => r.type === 65);
            if (rec) {
                const parsed = parseHttpsRecordFull(rec.data);
                if (parsed) {
                    result.ech = parsed.ech || null;
                    result.ipv4hints = parsed.ipv4hints || [];
                    result.ipv6hints = parsed.ipv6hints || [];
                }
            }
        }
        return result;
    }

    const answers = data?.Answer?.filter(r => r.type === dnsType).map(r => r.data) || [];
    return { domain, type, answers, ech: null };
}
/**
 * 加载/更新国内域名集合
 * 第一次调用时立即用内置后缀构建集合，后续异步拉取远程列表，不阻塞请求。
 */
async function ensureCNDomainSet() {
    const now = Date.now();
    // 已有有效缓存，直接返回
    if (cnDomainSet && ( now - cnDomainLastFetch) < CN_DOMAIN_CACHE_TTL) {
        return;
    }
    // 2. 从Cache API读取（新增）
    const cacheKey = `https://dns-cache/cn/domains`;
    const cachedText = await readCache(cacheKey);
    if (cachedText) {
        const domains = new Set(CN_DOMAIN_SUFFIXES);
        for (const line of cachedText.split(/\r?\n/)) {
            const d = line.trim();
            if (d && !d.startsWith('#')) domains.add(d);
        }
        cnDomainSet = domains;
        cnDomainLastFetch = now;
        return;
    }
    // 如果集合为空，先用内置后缀创建临时集合，保证匹配立即可用
    if (!cnDomainSet) {
        cnDomainSet = new Set(CN_DOMAIN_SUFFIXES);
        cnDomainLastFetch = 0; // 标记为需要更新
    }

    // 异步下载最新列表（不阻塞当前调用者）
    try {
        const res = await fetch(CN_DOMAIN_LIST_URL);
        if (res.ok) {
            const domains = new Set(CN_DOMAIN_SUFFIXES); // 内置后缀始终包含
            const text = await res.text();
            for (const line of text.split(/\r?\n/)) {
                const d = line.trim();
                if (d && !d.startsWith('#')) {
                    domains.add(d);
                }
            }
            cnDomainSet = domains;
            cnDomainLastFetch = Date.now();
            // 异步写入 Cache API（新增）
            writeCache(cacheKey, text, CN_DOMAIN_CACHE_TTL / 1000);
        }
    } catch (e) {
        // 远程加载失败，继续使用现有集合（临时内置集合或上次缓存）
        // 更新时间戳，避免短时间内重复尝试
        cnDomainLastFetch = Date.now();
    }
}

/**
 * 判断是否为国内域名
 * 匹配规则：完整域名在集合中，或域名以集合中某个 '.' 开头的后缀结尾。
 */
function isCNDomain(domain) {
    // cnDomainSet 在 ensureCNDomainSet 中已保证非空，直接使用
    if (cnDomainSet.has(domain)) return true;
    for (const item of cnDomainSet) {
        if (item.startsWith('.') && domain.endsWith(item)) {
            return true;
        }
    }
    return false;
}

/**
 * 从 IPv6 前缀生成指定数量的随机 IPv6 地址
 * @param {string} prefixStr - 前缀字符串，如 "2001:4860:4827:7700::/64"
 * @returns {string[]} 随机 IPv6 地址数组
 */
function generateRandomIPv6(prefixStr) {
    const [addrStr, bitsStr] = prefixStr.split('/');
    const prefixLen = parseInt(bitsStr, 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128) return [];

    // 将前缀地址转换为 128 位 BigInt
    const baseIP = ipv6ToBigInt(addrStr);
    const hostBits = 128 - prefixLen;
    const maxHost = (1n << BigInt(hostBits)) - 1n;

    // 主机位不能全0（网络地址）和全1（广播地址），实际 Google 全段可用，这里保守过滤
    const minHost = 1n;
    const maxValidHost = maxHost - 1n;

    const ips = [];
    for (let i = 0; i < RANDOM_IPV6_COUNT; i++) {
        const randomHost = randomBigInt(minHost, maxValidHost);
        const fullIP = baseIP | randomHost;
        ips.push(bigIntToIPv6(fullIP));
    }
    return ips;
}

/**
 * 生成介于 min 和 max 之间的随机 BigInt（包含两端）
 */
function randomBigInt(min, max) {
    const range = max - min + 1n;
    const bits = range.toString(2).length;
    let rand;
    const maxAttempts = 10; // 防止无限循环
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        rand = 0n;
        for (let i = 0; i < 16; i++) {
            rand = (rand << 8n) | BigInt(bytes[i]);
        }
        const mask = (1n << BigInt(bits)) - 1n;
        rand = rand & mask;
        if (rand <= range) {
            return min + rand;
        }
    }
    // 回退：返回 min
    return min;
}

/**
 * BigInt 转压缩 IPv6 字符串
 * 遵循 RFC 5952 标准，精准压缩全零段，规避边缘正则导致的格式隐患
 */
function bigIntToIPv6(big) {
    const segments = [];
    for (let i = 0; i < 8; i++) {
        // 每次向右平移 16 位，并取出最后的 16 位，转换为 16 进制字符串
        segments.unshift(Number((big >> BigInt(i * 16)) & 0xFFFFn).toString(16));
    }
    // 寻找最长的连续全零段（RFC 5952 标准压缩逻辑）
    let maxStart = -1, maxLen = 0;
    let curStart = -1, curLen = 0;
    for (let i = 0; i < 8; i++) {
        if (segments[i] === '0') {
            if (curStart === -1) curStart = i;
            curLen++;
            if (curLen > maxLen) {
                maxLen = curLen;
                maxStart = curStart;
            }
        } else {
            curStart = -1;
            curLen = 0;
        }
    }
    // 只有全零段长度大于 1 时才进行 "::" 压缩
    if (maxLen > 1) {
        const head = segments.slice(0, maxStart).join(':');
        const tail = segments.slice(maxStart + maxLen).join(':');
        return `${head}::${tail}`;
    }    
    // 如果没有连续的零段，则直接用单冒号连接返回
    return segments.join(':');
}

/**
 * 获取前缀对应的随机 IP 列表（带缓存）
 */
function getPrefixIPs(prefixStr) {
    const cached = prefixCache.get(prefixStr);
    if (cached && Date.now() < cached.expire) {
        return cached.ips;
    }
    const ips = generateRandomIPv6(prefixStr);
    prefixCache.set(prefixStr, { ips, expire: Date.now() + PREFIX_CACHE_TTL });
    return ips;
}

// ===================== IP 转换 =====================
function extractIpsFromPacket(buffer) {
    const ips = [];
    const view = new DataView(buffer);
    if (buffer.byteLength < 12) return [];
    const ancount = view.getUint16(6);
    const totalRecords = ancount + view.getUint16(8) + view.getUint16(10);
    let offset = 12;
    try {
        for (let i = 0; i < view.getUint16(4); i++) {
            while (view.getUint8(offset) !== 0) {
                if ((view.getUint8(offset) & 0xC0) === 0xC0) { offset += 1; break; }
                offset += view.getUint8(offset) + 1;
            }
            offset += 5;
        }
        for (let i = 0; i < totalRecords; i++) {
            while (view.getUint8(offset) !== 0) {
                if ((view.getUint8(offset) & 0xC0) === 0xC0) { offset += 1; break; }
                offset += view.getUint8(offset) + 1;
            }
            offset += 1;
            const type = view.getUint16(offset); offset += 8;
            const rdlen = view.getUint16(offset); offset += 2;
            if (type === 1 && rdlen === 4) {
                ips.push(Array.from(new Uint8Array(buffer.slice(offset, offset + 4))).join('.'));
            } else if (type === 28 && rdlen === 16) {
                const raw = new Uint8Array(buffer.slice(offset, offset + 16));
                ips.push(formatIPv6(raw));
            }
            offset += rdlen;
        }
    } catch (e) {}
    return ips;
}

function formatIPv6(bytes) {
    const parts = [];
    for (let i = 0; i < 16; i += 2) {
        parts.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
    }
    let longestStart = -1, longestLen = 0;
    let currentStart = -1, currentLen = 0;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '0') {
            if (currentStart === -1) currentStart = i;
            currentLen++;
            if (currentLen > longestLen) { longestLen = currentLen; longestStart = currentStart; }
        } else {
            currentStart = -1; currentLen = 0;
        }
    }
    if (longestLen > 1) {
        parts.splice(longestStart, longestLen, '');
        if (longestStart === 0) parts.unshift('');
        if (longestStart + longestLen === 8) parts.push('');
    }
    return parts.join(':').replace(/:{3,}/, '::');
}

function formatIPv6FromBytes(bytes) { return formatIPv6(bytes); }

function ipToLong(ip) {
    return ip.split('.').reduce((a, b) => (a << 8) + parseInt(b, 10), 0) >>> 0;
}

function ipv6ToBigInt(ip) {
    let p = ip.split(':');
    if (ip.includes('::')) {
        const [f, s] = ip.split('::');
        const fP = f ? f.split(':') : [];
        const sP = s ? s.split(':') : [];
        p = [...fP, ...Array(8 - fP.length - sP.length).fill('0'), ...sP];
    }
    return p.reduce((a, b) => (a << 16n) + BigInt(parseInt(b || '0', 16)), 0n);
}

function ipToBytes(ip) { return new Uint8Array(ip.split('.').map(Number)); }

function ipv6ToBytes(ip) {
    let p = ip.split(':');
    if (ip.includes('::')) {
        const [l, r] = ip.split('::');
        const lp = l ? l.split(':') : [];
        const rp = r ? r.split(':') : [];
        p = [...lp, ...Array(8 - lp.length - rp.length).fill('0'), ...rp];
    }
    const b = new Uint8Array(16);
    p.forEach((v, i) => {
        const val = parseInt(v, 16) || 0;
        b[i * 2] = val >> 8;
        b[i * 2 + 1] = val & 0xFF;
    });
    return b;
}

function bytesToIp(bytes) { return Array.from(bytes).join('.'); }
function bytesToIp6(bytes) { return formatIPv6(bytes); }

// ===================== CIDR 编译与匹配 =====================
function compileCidrs(cidrList) {
    const v4 = [], v6 = [];
    for (const cidr of cidrList) {
        try {
            const [ip, bitsStr] = cidr.split('/');
            const bits = parseInt(bitsStr, 10);
            if (ip.includes(':')) {
                const mask = ~( (1n << (128n - BigInt(bits))) - 1n );
                const ipBn = ipv6ToBigInt(ip);
                v6.push({ start: ipBn & mask, end: (ipBn & mask) | ( (1n << (128n - BigInt(bits))) - 1n ) });
            } else {
                const mask = ~((1 << (32 - bits)) - 1);
                const ipNum = ipToLong(ip);
                v4.push({ start: (ipNum & mask) >>> 0, end: ((ipNum & mask) | ((1 << (32 - bits)) - 1)) >>> 0 });
            }
        } catch (e) {}
    }
    return { v4, v6 };
}

function isIpInCidrs(ip, compiled) {
    if (ip.includes(':')) {
        try {
            const ipBn = ipv6ToBigInt(ip);
            return compiled.v6.some(r => ipBn >= r.start && ipBn <= r.end);
        } catch {}
    } else {
        try {
            const ipNum = ipToLong(ip);
            return compiled.v4.some(r => ipNum >= r.start && ipNum <= r.end);
        } catch {}
    }
    return false;
}

// ===================== 归属探测 =====================
async function activeProbeOwner(domain, ctx, clientIP) {
    const cacheKey = `owner:${domain}`;
    const cacheUrl = `https://dns-cache/${cacheKey}`;

    // 1. 内存缓存
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expire) return cached.value;

    // 2. Cache API（新增）
    try {
        const cachedText = await readCache(cacheUrl);
        if (cachedText) {
            const result = JSON.parse(cachedText);
            cacheMap.set(cacheKey, { value: result, expire: Date.now() + CACHE_TTL });
            return result;
        }
    } catch (e) {}

    // 3. 上游查询（原有逻辑）
    try {
        const data = await queryUpstreamDNS(domain, 1, clientIP);
        if (data && data.Answer) {
            const ips = data.Answer.filter(r => r.type === 1).map(r => r.data);
            for (const ip of ips) {
                if (isIpInCidrs(ip, getCompiledMeta())) {
                    const result = { owner: 'META', ips };
                    cacheMap.set(cacheKey, { value: result, expire: Date.now() + CACHE_TTL });
                    writeCache(cacheUrl, JSON.stringify(result), CACHE_TTL / 1000); // 异步写入
                    return result;
                }
                if (isIpInCidrs(ip, getCompiledCF())) {
                    const result = { owner: 'CF', ips };
                    cacheMap.set(cacheKey, { value: result, expire: Date.now() + CACHE_TTL });
                    writeCache(cacheUrl, JSON.stringify(result), CACHE_TTL / 1000); // 异步写入
                    return result;
                }
            }
        }
    } catch {}
    cacheMap.set(cacheKey, { value: null, expire: Date.now() + 60000 });
    return null;
}

// ===================== 订阅处理 =====================
async function applySubConfig(config) {
    const sub = config.sub;
    if (!sub) return;
    const excludeItems = new Set(
        (config.exclude || '').split(',').map(s => s.trim()).filter(s => s)
    );
    const areaFilter = (config.area || '').trim().toLowerCase();
    const areaMap = {
        'hk': '香港','hkg': '香港','sg': '新加坡','sin': '新加坡',
        'jp': '日本','tyo': '东京','nrt': '东京','kr': '韩国','sel': '首尔','icn': '首尔',
        'us': '美国','lax': '洛杉矶','sfo': '旧金山','sea': '西雅图',
        'uk': '英国','lhr': '伦敦','man': '曼彻斯特','de': '德国','fra': '法兰克福','ber': '柏林',
        'tw': '台湾','tpe': '台北','khh': '高雄','mo': '澳门','mfm': '澳门',
        'th': '泰国','bkk': '曼谷','vn': '越南','sgn': '胡志明','han': '河内',
        'id': '印尼','cgk': '雅加达','ph': '菲律宾','mnl': '马尼拉','my': '马来西亚','kul': '吉隆坡',
        'in': '印度','bom': '孟买','maa': '金奈','au': '澳大利亚','syd': '悉尼',
        'fr': '法国','par': '巴黎','nl': '荷兰','ams': '阿姆斯特丹','ca': '加拿大','yvr': '温哥华','yyz': '多伦多',
        'ru': '俄罗斯','mow': '莫斯科','ae': '阿联酋','dxb': '迪拜','sa': '沙特','jed': '吉达',
        'za': '南非','jnb': '约翰内斯堡','br': '巴西','sao': '圣保罗','mx': '墨西哥','mex': '墨西哥城',
        'ar': '阿根廷','eze': '布宜诺斯艾利斯','it': '意大利','mxp': '米兰',
        'es': '西班牙','bcn': '巴塞罗那','ch': '瑞士','zrh': '苏黎世','se': '瑞典','arn': '斯德哥尔摩',
        'no': '挪威','osl': '奥斯陆','fi': '芬兰','hel': '赫尔辛基','pl': '波兰','waw': '华沙',
        'cz': '捷克','prg': '布拉格','at': '奥地利','vie': '维也纳','ie': '爱尔兰','dub': '都柏林',
        'pt': '葡萄牙','lis': '里斯本','gr': '希腊','ath': '雅典','il': '以色列','tlv': '特拉维夫',
        'tr': '土耳其','ist': '伊斯坦布尔'
    };
    const entries = sub.split(',').map(s => s.trim()).filter(s => s);
    const allIps = new Set();
    const allDomains = new Set();
    for (const entry of entries) {
        const match = entry.match(/^(ip|cf)-(.+)$/);
        if (!match) continue;
        const [, type, url] = match;
        let content = null;
        const cacheKey = `https://dns-cache/sub/${encodeURIComponent(url)}`;
        const cached = subCache.get(url);
        // 1. 内存缓存
        if (cached && Date.now() < cached.expire) {
            content = cached.content;
        } else {
            // 2. Cache API（新增）
            const cachedText = await readCache(cacheKey);
            if (cachedText) {
                content = cachedText;
                subCache.set(url, { content, expire: Date.now() + SUB_CACHE_TTL });
            } else {
                 // 3. 远程下载（原有逻辑）
               try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timer);
                if (res.ok) {
                    content = await res.text();
                    subCache.set(url, { content, expire: Date.now() + SUB_CACHE_TTL });
                     // 异步写入 Cache API（新增）
                    writeCache(cacheKey, content, SUB_CACHE_TTL / 1000);
                } else if (cached) {
                    content = cached.content;
                    cached.expire = Date.now() + SUB_CACHE_TTL; // 延长过期时间                
                }
            } catch (e) {
                console.error('sub fetch error:', e);
                if (cached){ 
                    content = cached.content;
                    cached.expire = Date.now() + SUB_CACHE_TTL;
                }   
              }
           }
        }
        if (!content) continue;
        const lines = content.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                let comment = '';
                const commentIndex = line.indexOf('#');
                if (commentIndex !== -1) {
                    comment = line.substring(commentIndex + 1).trim();
                    line = line.substring(0, commentIndex).trim();
                }
                if (areaFilter && comment) {
                    const commentLower = comment.toLowerCase();
                    const keywords = areaFilter.split(',').map(k => k.trim()).filter(k => k);
                    if (keywords.length > 0) {
                        const matched = keywords.some(keyword => {
                            if (commentLower.includes(keyword)) return true;
                            const chineseName = areaMap[keyword];
                            if (chineseName && comment.includes(chineseName)) return true;
                            return false;
                        });
                        if (!matched) return null;
                    }
                }
                return line;
            })
            .filter(item => item !== null)
            .map(line => {
                if (type === 'ip') {
                    if (line.startsWith('[') && line.includes(']:')) {
                        line = line.substring(1, line.indexOf(']:'));
                    } else if (line.includes(':')) {
                        const ipv4Port = line.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
                        if (ipv4Port) line = ipv4Port[1];
                    }
                } else {
                    const portIndex = line.lastIndexOf(':');
                    if (portIndex !== -1) {
                        const host = line.substring(0, portIndex);
                        const port = line.substring(portIndex + 1);
                        if (/^\d+$/.test(port)) line = host;
                    }
                }
                return line.trim();
            })
            .filter(line => line && !excludeItems.has(line));
        for (const line of lines) {
            if (type === 'ip') allIps.add(line);
            else allDomains.add(line);
        }
    }
    if (allIps.size > 0) config.ip4 = Array.from(allIps).join(',');
    if (config.ip4) config.ip4 = prescreenIpList(config.ip4);
    if (allDomains.size > 0) config.cfDomain = Array.from(allDomains).join(',');
  
}

// ===================== 辅助函数 =====================
function isDomainIpv4Only(domain) {
    return IPV4_ONLY_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

/**
 * 从上游 A/AAAA 记录获取真实 IP hints
 */
async function resolveRealHints(domain, type, clientIP) {
    try {
        const data = await queryUpstreamDNS(domain, type, clientIP);
        if (data && data.Answer) {
            return data.Answer.filter(r => r.type === type).map(r => r.data);
        }
    } catch (e) {}
    return [];
}

/**
 * 解析原始 HTTPS 记录（用于增强模式）
 */
function parseRawHttpsRecord(dataStr) {
    const parts = dataStr.split(/\s+/);
    if (parts.length < 3) return [];
    const params = [];
    for (let i = 2; i < parts.length; i++) {
        const eqIdx = parts[i].indexOf('=');
        if (eqIdx === -1) continue;
        params.push({ key: parts[i].substring(0, eqIdx), val: parts[i].substring(eqIdx + 1) });
    }
    return params;
}

/**
 * 完整解析 HTTPS 记录（用于 JSON API 返回）
 */
function parseHttpsRecordFull(dataStr) {
    const parts = dataStr.split(/\s+/);
    if (parts.length < 3) return null;
    const result = {};
    for (let i = 2; i < parts.length; i++) {
        const [k, v] = parts[i].split('=');
        if (!k || !v) continue;
        if (k === 'ech') result.ech = v;
        else if (k === 'alpn') result.alpn = v;
        else if (k === 'ipv4hint') result.ipv4hints = v.split(',').map(s => s.trim());
        else if (k === 'ipv6hint') result.ipv6hints = v.split(',').map(s => s.trim());
    }
    return result;
}

/**
 * 返回 JSON 响应
 */
function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}
/**
 * 判断某条 DNS 记录类型（A 或 AAAA）是否被屏蔽
 * @param {string} type - 'A' 或 'AAAA'
 * @param {object|null} ruleObj - matchRule 返回的规则对象，未匹配则为 null
 * @param {object} config - 当前请求配置
 * @returns {boolean}
 */
function isTypeBlocked(type, ruleObj, config, isCF = false) {
    if (ruleObj) {
        if (type === 'A' && ruleObj.noA) return true;
        if (type === 'AAAA') {
            if (ruleObj.hasOwnProperty('noAAAA')) {
                return ruleObj.noAAAA;
            }
        }
    }
    // CF 站点默认禁用 IPv6（可通过 nocf6=false 开启）
    if (type === 'AAAA' && isCF && config.nocf6 !== 'false') {
        return true;
    }
    if (type === 'AAAA' && config.no6 === 'true') {
        return true;
    }
    return false;
}
function getHtml() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOH-ECH 查询</title>
    <style>
        :root {
            --bg: #0a0e17;
            --card: #111827;
            --text: #e2e8f0;
            --text-secondary: #94a3b8;
            --accent: #0A84FF;
            --accent-glow: rgba(10, 132, 255, 0.3);
            --border: #1e293b;
            --input-bg: #0f172a;
            --cf: #FF9F0A;
            --meta: #0A84FF;
            --enhance: #30D158;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, 'Inter', system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
            background-image: radial-gradient(ellipse at top, rgba(10, 132, 255, 0.25) 0%, transparent 60%),
                              radial-gradient(ellipse at bottom, rgba(255, 159, 10, 0.1) 0%, transparent 60%);
            -webkit-tap-highlight-color: transparent;
        }
        .container {
            background: rgba(30, 30, 30, 0.6);
            backdrop-filter: blur(25px) saturate(140%);
            -webkit-backdrop-filter: blur(25px) saturate(140%);
            border-radius: 32px;
            padding: 2rem;
            width: 100%;
            max-width: 700px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08);
            position: relative;
            overflow: hidden;
        }
        .container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -30%;
            width: 160%;
            height: 160%;
            background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 50%);
            pointer-events: none;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 1rem;
            position: relative;
            z-index: 1;
        }
        .logo {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, var(--accent), #5E5CE6);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            box-shadow: 0 4px 12px rgba(10, 132, 255, 0.4);
        }
        h1 { 
            font-size: 1.5rem; 
            font-weight: 600;
            letter-spacing: -0.02em;
        }
        .subtitle { 
            color: var(--text-secondary); 
            font-size: 0.75rem; 
            margin-bottom: 1.8rem;
            margin-left: 56px;
            position: relative;
            z-index: 1;
        }
        label { 
            font-size: 0.8rem; 
            font-weight: 500;
            display: block; 
            margin-bottom: 0.4rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: relative;
            z-index: 1;
        }
        input, select {
            width: 100%;
            padding: 0.7rem 1rem;
            margin-bottom: 1rem;
            background: rgba(255, 255, 255, 0.06);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            color: var(--text);
            font-size: 0.79rem;
            transition: all 0.2s;
            font-family: inherit;
            outline: none;
            position: relative;
            z-index: 1;
        }
        input:focus, select:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 4px var(--accent-glow);
            background: rgba(255, 255, 255, 0.12);
        }
        select {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23ffffff' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            padding-right: 2.5rem;
        }
        .row {
            display: flex;
            gap: 1rem;
            margin-bottom: 0.5rem;
            position: relative;
            z-index: 1;
        }
        .row > div {
            flex: 1;
        }
        .param-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0 1.5rem;
            position: relative;
            z-index: 1;
        }
        @media (max-width: 400px) {
            .param-grid {
                grid-template-columns: 1fr;
            }
        }
        .badge {
            display: inline-block;
            padding: 0.15rem 0.5rem;
            border-radius: 8px;
            font-size: 0.5rem;
            font-weight: 600;
            margin-left: 0.4px;
            margin-bottom: 3.8px;
            background: rgba(255,255,255,0.15);
            vertical-align: middle;
        }
        .badge-cf { color: var(--cf); }
        .badge-meta { color: var(--meta); }
        .badge-enhance { color: var(--enhance); }
        .toggle-row {
            display: flex;
            align-items: center;
            gap: 12px;
            position: relative;
            z-index: 1;
        }
        .checkbox-container {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
            position: relative;
            z-index: 1;
        }
        .checkbox-container input {
            display: none;
        }
        .checkmark {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.25);
            display: inline-block;
            position: relative;
            transition: all 0.2s;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            box-shadow: 0 0 8px rgba(255,255,255,0.1);
        }
        .checkbox-container input:checked + .checkmark {
            background: var(--accent);
            border-color: var(--accent);
            box-shadow: 0 0 14px var(--accent-glow);
        }
        .checkmark::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: white;
            transform: translate(-50%, -50%) scale(0);
            transition: transform 0.2s ease;
        }
        .checkbox-container input:checked + .checkmark::after {
            transform: translate(-50%, -50%) scale(1);
        }
        button {
            width: 100%;
            padding: 0.9rem 1rem;
            background: var(--accent);
            color: #fff;
            font-weight: 600;
            font-size: 1rem;
            border: none;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 1rem;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 4px 16px rgba(10, 132, 255, 0.4);
            position: relative;
            z-index: 1;
        }
        button:hover { 
            background: #2a93ff;
            box-shadow: 0 6px 24px rgba(10, 132, 255, 0.6);
            transform: translateY(-1px);
        }
        button:active { transform: translateY(0); }
        button:disabled { 
            opacity: 0.5; 
            cursor: not-allowed; 
            transform: none;
            box-shadow: none;
        }
        .result-box {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 14px;
            padding: 1.2rem;
            margin-top: 1.2rem;
            word-break: break-all;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.85rem;
            min-height: 60px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
            position: relative;
            z-index: 1;
        }
        .result-box.loading { 
            color: var(--accent); 
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .result-box.loading::before {
            content: '';
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255,255,255,0.2);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .result-box.error { color: #FF453A; border-color: rgba(255,69,58,0.3); }
        .advanced-section {
            margin: 1.2rem 0;
            padding: 1.2rem;
            background: rgba(255, 255, 255, 0.04);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: none;
            position: relative;
            z-index: 1;
        }
        .advanced-section.show { display: block; }
        .footer {
            text-align: center;
            margin-top: 1.5rem;
            color: var(--text-secondary);
            font-size: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            position: relative;
            z-index: 1;
        }
        .footer a {
            color: var(--text-secondary);
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .footer a:hover { color: var(--accent); }
        .global-section {
            margin: 1rem 0;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.04);
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
            z-index: 1;
        }
        .request-url-box {
            margin-top: 1rem;
            padding: 0.8rem 1rem;
            background: rgba(10, 132, 255, 0.1);
            border: 1px solid rgba(10, 132, 255, 0.3);
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.85rem;
            position: relative;
            z-index: 1;
            overflow-x: auto;
            white-space: nowrap;
        }
        .request-url-box span {
            flex-shrink: 0;
        }
        .request-url-box code {
            background: transparent;
            color: var(--accent);
            flex: 1;
            overflow-x: auto;
            white-space: nowrap;
            display: inline-block;
            padding-right: 0.5rem;
        }
        .copy-btn {
            padding: 0.4rem 1rem;
            background: var(--accent);
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 0.8rem;
            cursor: pointer;
            white-space: nowrap;
            box-shadow: none;
            margin: 0;
            width: auto;
            flex-shrink: 0;
        }
        .copy-btn:active { background: #2a93ff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔒</div>
            <h1>DOH-ECH 查询测试</h1>
        </div>
        <p class="subtitle">智能 DNS 解析 · ECH 注入 · ECS 就近解析</p>
        
        <div class="row">
            <div>
                <label for="domain">查询域名</label>
                <input type="text" id="domain" placeholder="输入域名，例如 twitter.com" value="twitter.com" autofocus style="margin-bottom:0">
            </div>
            <div>
                <label for="type">记录类型</label>
                <select id="type" style="margin-bottom:0">
                    <option value="A">A (IPv4)</option>
                    <option value="AAAA">AAAA (IPv6)</option>
                    <option value="HTTPS">HTTPS (ECH)</option>
                </select>
            </div>
        </div>

        <div class="row" style="align-items: flex-end;">
            <div>
                <label for="mode">模式选择</label>
                <select id="mode" onchange="onModeChange()" style="margin-bottom:0">
                    <option value="">默认解析</option>
                    <option value="cf">🔶 CF 优选</option>
                    <option value="meta">🔵 Meta 优选</option>
                    <option value="enhance">🟢 HTTPS 增强</option>
                </select>
            </div>
            <div style="display:flex; align-items:center; padding-bottom:0.5rem;">
                <label class="checkbox-container" style="margin-bottom:0;">
                    <input type="checkbox" id="best" onchange="updateBestLabel()">
                    <span class="checkmark"></span>
                    <span id="bestLabel">全局跟随优选</span>
                </label>
            </div>
        </div>

        <!-- Cloudflare 高级参数 -->
        <div id="cfParams" class="advanced-section">
            <div class="param-grid">
                <div>
                    <label>CF IPv4 <span class="badge badge-cf">ip4</span></label>
                    <input type="text" id="ip4" placeholder="1.2.3.4, 5.6.7.8">
                </div>
                <div>
                    <label>CF IPv6 <span class="badge badge-cf">ip6</span></label>
                    <input type="text" id="ip6" placeholder="2606:4700::, 2606:4700::1">
                </div>
                <div>
                    <label>优选域名 <span class="badge badge-cf">cf</span></label>
                    <input type="text" id="cfDomain" placeholder="example.com, example2.com">
                </div>
                <div>
                    <label>ECH 来源 <span class="badge badge-cf">ech</span></label>
                    <input type="text" id="echDomain" placeholder="cloudflare-ech.com">
                </div>
                <div>
                    <label>优选订阅 <span class="badge badge-cf">sub</span></label>
                    <input type="text" id="sub" placeholder="ip-URL 或 cf-URL，逗号分隔">
                </div>
                <div>
                    <label>排除项 <span class="badge badge-cf">exclude</span></label>
                    <input type="text" id="exclude" placeholder="1.2.3.4,bad.example.com">
                </div>
                <div>
                    <label>地区筛选 <span class="badge badge-cf">area</span></label>
                    <input type="text" id="area" placeholder="hk, hkg, 香港, sin 等，留空全部">
                </div>
                <div>                    
                    <label class="checkbox-container">
                      <input type="checkbox" id="shuffle" checked>
                      <span class="checkmark"></span>
                      <span>随机乱序 IP</span>
                    </label>  
                </div>                    
            </div>         
        </div>

        <!-- Meta 高级参数 -->
        <div id="metaParams" class="advanced-section">
            <div class="param-grid">
                <div>
                    <label>Meta IPv4 <span class="badge badge-meta">metaIp4</span></label>
                    <input type="text" id="metaIp4" placeholder="157.240.1.1, 157.240.2.1">
                </div>
                <div>
                    <label>Meta IPv6 <span class="badge badge-meta">metaIp6</span></label>
                    <input type="text" id="metaIp6" placeholder="2a03:2880:...">
                </div>
                <div>
                    <label>优选域名<span class="badge badge-meta">meta</span></label>
                    <input type="text" id="metaDomain" placeholder="meta-better.example.com">
                </div>
            </div>
        </div>

        <!-- HTTPS 增强参数 -->
        <div id="enhanceParams" class="advanced-section">
            <div class="param-grid">
                <div>
                    <label>增强模式<span class="badge badge-enhance">enhance</span></label>
                    <select id="enhance">
                        <option value="off">关闭</option>
                        <option value="rule">规则模式</option>
                        <option value="full">全局模式</option>
                    </select>
                </div>
                <div>
                    <label>规则 <span class="badge badge-enhance">rules</span></label>
                    <input type="text" id="rules" placeholder="*.reddit.com:ip1,ip2-noA-noAAAA">
                </div>
            </div>
        </div>

        <!-- 全局设置 -->
        <div class="global-section">
            <div class="param-grid">
                <div>
                    <label>ALPN 列表 <span class="badge">alpn</span></label>
                    <input type="text" id="alpn" placeholder="h3,h2" value="h3,h2">
                </div>
                <div>
                    <label>ECS <span class="badge">clientIp</span></label></label>
                    <input type="text" id="clientIp" placeholder="1.2.4.8" value="">
                </div>
                <div class="toggle-row" style="margin-top: 0.5rem;">
    <label class="checkbox-container">
        <input type="checkbox" id="no6">
        <span class="checkmark"></span>
        <span>全局屏蔽 AAAA</span>
    </label>
</div>
            </div>
        </div>

        <button id="queryBtn" onclick="doQuery()">
            <span id="btnText">🔍 开始查询</span>
        </button>

        <div id="requestUrlContainer" style="display:none;">
            <div class="request-url-box">
                <span>DoH:</span>
                <code id="requestUrlText"></code>
                <button class="copy-btn" id="copyBtn" onclick="copyUrl()">复制</button>
            </div>
        </div>
        <div id="result" class="result-box" style="display: none;"></div>
        <div class="footer">
            <span>DoH-ECH · Cloudflare Pages · </span>
            <a href="https://github.com/rosenii/doh-ech" target="_blank" rel="noopener noreferrer">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                GitHub
            </a>
        </div>
    </div>
    <script>
        function onModeChange() {
            const mode = document.getElementById('mode').value;
            document.getElementById('cfParams').classList.toggle('show', mode === 'cf');
            document.getElementById('metaParams').classList.toggle('show', mode === 'meta');
            document.getElementById('enhanceParams').classList.toggle('show', mode === 'enhance');
        }

        function updateBestLabel() {
            const checked = document.getElementById('best').checked;
            document.getElementById('bestLabel').textContent = checked ? '全局跟随优选(开)' : '全局跟随优选(关)';
        }

 async function copyUrl() {
            const url = document.getElementById('requestUrlText').textContent;
            try {
                await navigator.clipboard.writeText(url);
                const btn = document.getElementById('copyBtn');
                btn.textContent = '已复制';
                setTimeout(() => { btn.textContent = '复制'; }, 1500);
            } catch (err) {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                const btn = document.getElementById('copyBtn');
                btn.textContent = '已复制';
                setTimeout(() => { btn.textContent = '复制'; }, 1500);
            }
        }

        function buildEchUrl() {
            const params = new URLSearchParams();
            const mode = document.getElementById('mode').value;
            const bestChecked = document.getElementById('best').checked;
            if (bestChecked) params.set('best', 'true');

            const alpn = document.getElementById('alpn').value.trim();
            if (alpn) params.set('alpn', alpn);
            const clientIp = document.getElementById('clientIp').value.trim();
            if (clientIp) params.set('clientIp', clientIp);
            const no6 = document.getElementById('no6').checked;
            if (no6) params.set('no6', 'true');
            if (mode === 'cf') {
                const ip4 = document.getElementById('ip4').value.trim();
                const ip6 = document.getElementById('ip6').value.trim();
                const cfDomain = document.getElementById('cfDomain').value.trim();
                const echDomain = document.getElementById('echDomain').value.trim();
                const sub = document.getElementById('sub').value.trim();
                const exclude = document.getElementById('exclude').value.trim();
                const area = document.getElementById('area').value.trim();
                const shuffleChecked = document.getElementById('shuffle').checked;
                if (ip4) params.set('ip4', ip4);
                if (ip6) params.set('ip6', ip6);
                if (cfDomain) params.set('cf', cfDomain);
                if (echDomain) params.set('ech', echDomain);
                if (sub) params.set('sub', sub);
                if (exclude) params.set('exclude', exclude);
                if (area) params.set('area', area);
                if (!shuffleChecked) params.set('shuffle', 'false');
            } else if (mode === 'meta') {
                const metaIp4 = document.getElementById('metaIp4').value.trim();
                const metaIp6 = document.getElementById('metaIp6').value.trim();
                const metaDomain = document.getElementById('metaDomain').value.trim();
                if (metaIp4) params.set('metaIp4', metaIp4);
                if (metaIp6) params.set('metaIp6', metaIp6);
                if (metaDomain) params.set('meta', metaDomain);
            } else if (mode === 'enhance') {
                const enhance = document.getElementById('enhance').value;
                const rules = document.getElementById('rules').value.trim();
                if (enhance !== 'off') params.set('enhance', enhance);
                if (rules) params.set('rules', rules);
            }

            const base = window.location.origin + '/ech';
            const qs = params.toString();
            return qs ? base + '?' + qs : base;
        }

        async function doQuery() {
            const domain = document.getElementById('domain').value.trim();
            const type = document.getElementById('type').value;
            const mode = document.getElementById('mode').value;
            const btn = document.getElementById('queryBtn');
            const btnText = document.getElementById('btnText');
            const resultDiv = document.getElementById('result');
            const requestUrlContainer = document.getElementById('requestUrlContainer');
            const requestUrlText = document.getElementById('requestUrlText');

            if (!domain) {
                resultDiv.innerHTML = '<span class="error">请输入域名</span>';
                resultDiv.className = 'result-box error';
                resultDiv.style.display = 'block';
                requestUrlContainer.style.display = 'none';
                return;
            }

            requestUrlText.textContent = buildEchUrl();
            requestUrlContainer.style.display = 'block';

            const params = new URLSearchParams();
            params.set('domain', domain);
            params.set('type', type);

            const bestChecked = document.getElementById('best').checked;
            params.set('best', bestChecked ? 'true' : 'false');

            // 全局参数
            const alpn = document.getElementById('alpn').value.trim();
            if (alpn) params.set('alpn', alpn);
            const clientIp = document.getElementById('clientIp').value.trim();
            if (clientIp) params.set('clientIp', clientIp);
            const no6 = document.getElementById('no6').checked;
            if (no6) params.set('no6', 'true');
            if (mode === 'cf') {
                const ip4 = document.getElementById('ip4').value.trim();
                const ip6 = document.getElementById('ip6').value.trim();
                const cfDomain = document.getElementById('cfDomain').value.trim();
                const echDomain = document.getElementById('echDomain').value.trim();
                const sub = document.getElementById('sub').value.trim();
                const exclude = document.getElementById('exclude').value.trim();
                const shuffleChecked = document.getElementById('shuffle').checked;
                const area = document.getElementById('area').value.trim();
                if (ip4) params.set('ip4', ip4);
                if (ip6) params.set('ip6', ip6);
                if (cfDomain) params.set('cf', cfDomain);
                if (echDomain) params.set('ech', echDomain);
                if (sub) params.set('sub', sub);
                if (exclude) params.set('exclude', exclude);
                params.set('shuffle', shuffleChecked ? 'true' : 'false');
                if (area) params.set('area', area);
            } else if (mode === 'meta') {
                const metaIp4 = document.getElementById('metaIp4').value.trim();
                const metaIp6 = document.getElementById('metaIp6').value.trim();
                const metaDomain = document.getElementById('metaDomain').value.trim();
                if (metaIp4) params.set('metaIp4', metaIp4);
                if (metaIp6) params.set('metaIp6', metaIp6);
                if (metaDomain) params.set('meta', metaDomain);
            } else if (mode === 'enhance') {
                const enhance = document.getElementById('enhance').value;
                const rules = document.getElementById('rules').value.trim();
                if (enhance !== 'off') params.set('enhance', enhance);
                if (rules) params.set('rules', rules);
            }

            btn.disabled = true;
            btnText.textContent = '⏳ 查询中...';
            resultDiv.className = 'result-box loading';
            resultDiv.textContent = '';
            resultDiv.style.display = 'block';
            try {
                const res = await fetch('/api/query?' + params.toString());
                const data = await res.json();
                if (data.error) {
                    resultDiv.textContent = '错误：' + data.error;
                    resultDiv.className = 'result-box error';
                } else {
                    resultDiv.textContent = JSON.stringify(data, null, 2);
                    resultDiv.className = 'result-box';
                }
            } catch (err) {
                resultDiv.textContent = '网络错误：' + err.message;
                resultDiv.className = 'result-box error';
            } finally {
                btn.disabled = false;
                btnText.textContent = '🔍 开始查询';
            }
        }

        updateBestLabel();
    </script>
</body>
</html>`;
}
