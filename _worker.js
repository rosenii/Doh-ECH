
/**
 * DOH-ECH 
 * - 支持 ECS、clientIp 自定义
 * - 支持CF/Meta 多域名优选、best 跟随优选
 * - 支持注入ECH，完整iphints
 * - 缓存时间 A/AAAA 300s，HTTPS  600s
 */

// ===================== 全局配置 =====================
const UPSTREAM_DNS_GOOGLE = 'https://dns.google/dns-query';
const UPSTREAM_DNS_ALI = 'https://dns.alidns.com/dns-query';
const UPSTREAM_JSON_GOOGLE = 'https://dns.google/resolve';
const UPSTREAM_JSON_ALI = 'https://dns.alidns.com/resolve';

const CF_STATIC_DOMAINS = [
    "twimg.com", "twitter.com", "x.com", "t.co",
    "cloudflare-dns.com", "pages.dev", "workers.dev", "cloudflare.com"
];
const DEFAULT_CF_IP = "104.18.10.118";
const DEFAULT_CF_IP6 = "2606:4700::6812:a76";

const META_DOMAINS = [
    "facebook.com", "messenger.com", "instagram.com",
    "whatsapp.com", "fb.com", "meta.com"
];
const DEFAULT_META_IP = "157.240.1.35";

const IPV4_ONLY_DOMAINS = ["twitter.com", "x.com", "t.co", "twimg.com"];

const META_ECH_CONFIG = "AEj+DQBEAQAgACAdd+scUi0IYFsXnUIU7ko2Nd9+F8M26pAGZVpz/KrWPgAEAAEAAWQVZWNoLXB1YmxpYy5hdG1ldGEuY29tAAA=";

//   CIDR 列表
const RAW_META_CIDRS = [
'31.13.24.0/21','31.13.64.0/18','45.64.40.0/22','57.141.0.0/24','57.141.2.0/23','57.141.4.0/22','57.141.8.0/21','57.141.16.0/23','57.144.0.0/14','66.220.144.0/20','69.63.176.0/20','69.171.224.0/19','74.119.76.0/22','102.132.96.0/20','102.132.112.0/24','102.132.114.0/23','102.132.116.0/23','102.132.119.0/24','102.132.120.0/23','102.132.123.0/24','102.132.125.0/24','102.132.126.0/23','102.221.188.0/22','103.4.96.0/22','129.134.0.0/17','129.134.130.0/24','129.134.135.0/24','129.134.136.0/22','129.134.140.0/24','129.134.143.0/24','129.134.144.0/24','129.134.147.0/24','129.134.148.0/23','129.134.154.0/23','129.134.156.0/22','129.134.160.0/22','129.134.164.0/23','129.134.168.0/21','129.134.176.0/20','129.134.194.0/24','157.240.0.0/17','157.240.128.0/23','157.240.131.0/24','157.240.132.0/24','157.240.134.0/24','157.240.136.0/23','157.240.139.0/24','157.240.156.0/23','157.240.159.0/24','157.240.169.0/24','157.240.175.0/24','157.240.177.0/24','157.240.179.0/24','157.240.181.0/24','157.240.182.0/23','157.240.184.0/21','157.240.192.0/18','163.70.128.0/17','163.77.132.0/23','163.77.136.0/23','163.114.128.0/20','173.252.64.0/18','179.60.192.0/22','185.60.216.0/22','185.89.216.0/22','199.201.64.0/22','204.15.20.0/22','2620:0:1c00::/40','2620:10d:c090::/44','2a03:2880::/32','2a03:2887:ff00::/48','2a03:2887:ff02::/48','2a03:2887:ff04::/46','2a03:2887:ff09::/48','2a03:2887:ff0a::/48','2a03:2887:ff1b::/48','2a03:2887:ff1c::/48','2a03:2887:ff1e::/48','2a03:2887:ff20::/48','2a03:2887:ff22::/47','2a03:2887:ff27::/48','2a03:2887:ff28::/46','2a03:2887:ff2f::/48','2a03:2887:ff30::/48','2a03:2887:ff33::/48','2a03:2887:ff37::/48','2a03:2887:ff38::/46','2a03:2887:ff3f::/48','2a03:2887:ff40::/46','2a03:2887:ff44::/47','2a03:2887:ff48::/46','2a03:2887:ff4d::/48','2a03:2887:ff4e::/47','2a03:2887:ff50::/45','2a03:2887:ff58::/47','2a03:2887:ff5a::/48','2a03:2887:ff5f::/48','2a03:2887:ff60::/48','2a03:2887:ff62::/47','2a03:2887:ff64::/46','2a03:2887:ff68::/47','2a03:2887:ff6a::/48','2a03:2887:ff70::/47','2c0f:ef78:3::/48','2c0f:ef78:5::/48','2c0f:ef78:9::/48','2c0f:ef78:c::/47','2c0f:ef78:e::/48','2c0f:ef78:10::/47'
];

const RAW_CF_CIDRS = [
'5.10.214.0/23','5.10.244.0/22','5.175.141.0/24','5.182.84.0/23','5.226.179.0/24','5.226.181.0/24','5.226.183.0/24','8.6.112.0/24','8.6.144.0/23','8.9.231.0/24','8.10.148.0/24','8.14.199.0/24','8.14.201.0/24','8.14.202.0/24','8.14.204.0/24','8.17.205.0/24','8.17.206.0/23','8.18.50.0/24','8.18.113.0/24','8.18.195.0/24','8.18.196.0/24','8.19.8.0/24','8.20.100.0/23','8.20.103.0/24','8.20.122.0/23','8.20.124.0/23','8.20.126.0/24','8.21.8.0/23','8.21.10.0/24','8.21.12.0/23','8.21.110.0/23','8.21.239.0/24','8.23.139.0/24','8.23.240.0/24','8.24.87.0/24','8.24.243.0/24','8.24.244.0/24','8.25.96.0/23','8.25.249.0/24','8.26.182.0/24','8.27.64.0/24','8.27.66.0/23','8.27.68.0/23','8.27.79.0/24','8.28.20.0/24','8.28.82.0/24','8.28.126.0/23','8.28.213.0/24','8.29.105.0/24','8.29.109.0/24','8.29.228.0/24','8.29.230.0/23','8.30.234.0/24','8.31.2.0/24','8.31.160.0/23','8.34.69.0/24','8.34.70.0/23','8.34.146.0/24','8.34.201.0/24','8.34.202.0/24','8.35.57.0/24','8.35.58.0/24','8.35.149.0/24','8.35.211.0/24','8.36.216.0/22','8.36.220.0/24','8.37.41.0/24','8.37.43.0/24','8.38.147.0/24','8.38.148.0/23','8.39.6.0/24','8.39.18.0/24','8.39.125.0/24','8.39.126.0/24','8.39.201.0/24','8.39.202.0/23','8.39.204.0/22','8.39.213.0/24','8.39.214.0/23','8.40.26.0/23','8.40.29.0/24','8.40.30.0/23','8.40.107.0/24','8.40.111.0/24','8.40.140.0/24','8.41.5.0/24','8.41.6.0/23','8.41.36.0/23','8.42.51.0/24','8.42.54.0/23','8.42.161.0/24','8.42.164.0/24','8.42.172.0/24','8.43.121.0/24','8.43.122.0/23','8.43.224.0/23','8.43.226.0/24','8.44.2.0/24','8.44.6.0/24','8.44.60.0/24','8.44.62.0/23','8.45.41.0/24','8.45.43.0/24','8.45.44.0/22','8.45.97.0/24','8.45.100.0/23','8.45.102.0/24','8.45.108.0/24','8.45.111.0/24','8.45.145.0/24','8.45.146.0/23','8.46.113.0/24','8.46.115.0/24','8.46.117.0/24','8.46.118.0/23','8.47.9.0/24','8.47.12.0/23','8.47.15.0/24','8.47.69.0/24','8.47.71.0/24','8.48.130.0/23','8.48.132.0/23','8.48.134.0/24','14.102.228.0/23','23.131.204.0/24','23.145.136.0/24','23.145.152.0/24','23.145.232.0/24','23.145.248.0/24','23.167.152.0/24','23.178.112.0/24','23.179.248.0/24','23.180.136.0/24','23.227.37.0/24','23.227.38.0/23','23.227.48.0/23','23.227.60.0/24','23.247.163.0/24','25.25.25.0/24','25.26.27.0/24','25.129.196.0/22','27.50.48.0/23','31.12.75.0/24','31.43.179.0/24','31.185.108.0/24','37.153.171.0/24','38.96.28.0/23','44.31.142.0/24','45.8.211.0/24','45.12.30.0/23','45.80.108.0/24','45.80.110.0/23','45.81.58.0/24','45.85.118.0/23','45.95.241.0/24','45.128.76.0/24','45.130.125.0/24','45.131.4.0/22','45.131.208.0/22','45.135.235.0/24','45.142.120.0/24','45.146.201.0/24','45.149.12.0/24','45.153.7.0/24','45.157.17.0/24','45.192.222.0/23','45.192.224.0/24','45.194.11.0/24','45.194.53.0/24','45.195.14.0/24','45.196.29.0/24','45.199.183.0/24','45.202.113.0/24','45.205.0.0/24','45.250.154.0/23','46.202.30.0/24','46.254.92.0/23','49.213.44.0/24','49.238.236.0/22','61.32.240.0/24','62.72.166.0/24','62.146.255.0/24','62.169.155.0/24','64.40.138.0/24','64.40.140.0/24','64.69.24.0/23','64.239.31.0/24','65.110.63.0/24','65.205.150.0/24','66.45.118.0/24','66.71.220.0/24','66.81.247.0/24','66.81.255.0/24','66.84.82.0/24','66.93.178.0/24','66.94.32.0/20','66.203.249.0/24','66.225.252.0/24','66.235.200.0/24','68.169.48.0/20','68.182.187.0/24','69.48.218.0/24','69.89.0.0/20','69.90.210.0/24','72.52.113.0/24','74.49.214.0/23','74.204.59.0/24','74.205.180.0/24','77.37.33.0/24','77.74.228.0/24','77.75.199.0/24','77.105.163.0/24','77.111.106.0/24','77.232.140.0/24','78.128.122.0/24','80.93.202.0/24','82.21.82.0/24','82.22.16.0/24','82.26.156.0/24','82.118.242.0/24','82.139.216.0/23','83.118.224.0/22','86.38.214.0/24','86.38.251.0/24','87.229.48.0/24','88.216.66.0/23','88.216.69.0/24','89.47.56.0/23','89.106.90.0/24','89.116.46.0/24','89.116.161.0/24','89.116.180.0/24','89.116.250.0/24','89.117.112.0/24','89.207.18.0/24','89.249.200.0/24','91.124.127.0/24','91.192.106.0/24','91.193.58.0/23','91.199.81.0/24','91.206.71.0/24','91.209.253.0/24','92.53.188.0/22','92.60.74.0/24','92.243.74.0/23','93.114.64.0/23','93.115.102.0/24','94.140.0.0/24','94.156.10.0/24','94.247.142.0/24','96.43.100.0/23','102.132.188.0/24','102.177.176.0/24','102.177.189.0/24','103.11.212.0/24','103.11.214.0/24','103.15.85.0/24','103.19.144.0/23','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','103.31.79.0/24','103.81.228.0/24','103.112.176.0/24','103.116.7.0/24','103.121.59.0/24','103.133.1.0/24','103.135.208.0/23','103.169.142.0/24','103.172.110.0/23','103.186.74.0/24','103.198.92.0/24','103.204.13.0/24','103.215.22.0/24','103.219.64.0/22','103.245.228.0/23','104.16.0.0/13','104.24.0.0/14','104.28.0.0/16','104.29.0.0/21','104.29.8.0/23','104.29.11.0/24','104.29.12.0/22','104.29.16.0/23','104.29.19.0/24','104.29.20.0/22','104.29.24.0/21','104.29.32.0/24','104.29.34.0/23','104.29.36.0/22','104.29.40.0/22','104.29.44.0/23','104.29.47.0/24','104.29.48.0/23','104.29.50.0/24','104.29.52.0/22','104.29.57.0/24','104.29.59.0/24','104.29.61.0/24','104.29.62.0/23','104.29.64.0/23','104.29.67.0/24','104.29.68.0/22','104.29.72.0/21','104.29.80.0/23','104.29.82.0/24','104.29.85.0/24','104.29.86.0/24','104.29.88.0/21','104.29.96.0/22','104.29.100.0/23','104.29.102.0/24','104.29.104.0/21','104.29.112.0/22','104.29.116.0/23','104.29.121.0/24','104.29.122.0/23','104.29.124.0/22','104.29.128.0/18','104.30.0.0/19','104.30.32.0/23','104.30.128.0/23','104.30.132.0/22','104.30.136.0/23','104.30.144.0/21','104.30.160.0/19','104.31.0.0/21','104.31.16.0/22','104.31.20.0/24','104.36.195.0/24','104.129.164.0/22','104.156.176.0/23','104.165.248.0/24','104.234.239.0/24','104.239.72.0/24','104.254.140.0/24','108.162.192.0/18','108.165.152.0/24','108.165.216.0/24','109.234.211.0/24','114.129.43.0/24','123.108.75.0/24','130.108.73.0/24','130.108.104.0/23','130.108.121.0/24','130.108.253.0/24','131.0.72.0/22','131.167.255.0/24','136.143.138.0/24','137.66.96.0/24','138.5.248.0/24','138.226.234.0/24','138.249.21.0/24','139.64.234.0/23','140.99.233.0/24','141.11.202.0/23','141.101.64.0/18','141.193.213.0/24','143.14.224.0/24','143.14.229.0/24','143.14.251.0/24','143.20.247.0/24','144.124.211.0/24','147.78.140.0/24','147.185.161.0/24','148.227.167.0/24','150.48.128.0/18','151.243.128.0/22','151.243.133.0/24','151.246.216.0/23','152.114.0.0/17','152.114.128.0/18','154.51.129.0/24','154.51.160.0/24','154.62.129.0/24','154.81.141.0/24','154.83.2.0/24','154.83.22.0/23','154.83.30.0/24','154.84.14.0/23','154.84.16.0/24','154.84.18.0/24','154.84.20.0/23','154.84.24.0/24','154.84.26.0/23','154.90.70.0/24','154.92.9.0/24','154.193.133.0/24','154.193.184.0/24','154.194.12.0/24','154.194.225.0/24','154.197.64.0/23','154.197.75.0/24','154.197.80.0/24','154.197.88.0/24','154.197.108.0/24','154.197.121.0/24','154.198.173.0/24','154.200.89.0/24','154.202.89.0/24','154.206.12.0/24','154.207.77.0/24','154.207.79.0/24','154.207.127.0/24','154.207.189.0/24','154.207.252.0/23','154.211.8.0/24','154.218.15.0/24','154.219.5.0/24','154.223.134.0/23','155.46.167.0/24','155.46.213.0/24','156.224.73.0/24','156.225.72.0/24','156.243.83.0/24','156.243.246.0/24','156.246.69.0/24','156.246.70.0/24','156.252.2.0/23','156.255.123.0/24','158.94.212.0/24','159.112.235.0/24','159.242.242.0/24','159.246.55.0/24','160.153.0.0/24','161.248.134.0/23','162.44.32.0/22','162.44.118.0/23','162.44.208.0/23','162.120.94.0/24','162.158.0.0/15','162.251.82.0/24','162.251.205.0/24','164.38.155.0/24','164.77.28.0/23','165.101.60.0/23','167.1.137.0/24','167.1.148.0/23','167.1.150.0/24','167.1.181.0/24','167.68.4.0/23','167.68.11.0/24','167.68.42.0/24','167.74.94.0/23','167.74.130.0/24','169.40.133.0/24','169.197.101.0/24','170.114.45.0/24','170.114.46.0/24','170.114.52.0/24','170.114.78.0/24','170.168.7.0/24','170.176.152.0/24','170.176.163.0/24','172.64.0.0/13','172.83.72.0/23','172.83.76.0/24','173.0.92.0/24','173.245.48.0/20','176.103.113.0/24','176.124.223.0/24','176.126.206.0/23','178.94.249.0/24','178.211.142.0/24','178.213.76.0/24','181.214.1.0/24','182.23.210.0/24','184.174.80.0/24','185.7.190.0/23','185.7.240.0/24','185.18.184.0/24','185.18.250.0/24','185.29.76.0/24','185.38.25.0/24','185.38.135.0/24','185.60.251.0/24','185.122.0.0/24','185.126.66.0/24','185.132.85.0/24','185.132.86.0/23','185.133.172.0/24','185.135.9.0/24','185.146.172.0/23','185.148.104.0/22','185.149.135.0/24','185.156.19.0/24','185.158.133.0/24','185.159.247.0/24','185.162.228.0/22','185.170.166.0/24','185.176.24.0/24','185.176.26.0/24','185.178.196.0/22','185.193.28.0/22','185.207.92.0/24','185.207.196.0/22','185.209.154.0/24','185.229.206.0/24','185.238.228.0/24','185.251.80.0/23','188.42.88.0/23','188.42.98.0/24','188.42.145.0/24','188.95.12.0/24','188.114.96.0/20','188.164.158.0/23','188.164.248.0/24','188.244.122.0/24','190.93.240.0/20','192.65.217.0/24','192.71.82.0/24','192.86.150.0/24','192.103.56.0/24','192.133.11.0/24','192.152.138.0/24','192.236.26.0/24','193.8.237.0/24','193.9.49.0/24','193.16.63.0/24','193.17.206.0/24','193.67.144.0/24','193.124.18.0/24','193.124.224.0/24','193.162.35.0/24','193.202.90.0/24','193.227.99.0/24','193.233.21.0/24','193.233.132.0/24','194.1.194.0/24','194.26.68.0/24','194.36.49.0/24','194.36.55.0/24','194.39.112.0/21','194.41.114.0/24','194.53.53.0/24','194.59.5.0/24','194.113.223.0/24','194.152.44.0/24','194.169.194.0/24','195.26.229.0/24','195.28.190.0/23','195.82.109.0/24','195.85.23.0/24','195.85.59.0/24','195.189.177.0/24','195.242.122.0/23','195.245.221.0/24','195.250.46.0/24','196.13.241.0/24','196.207.45.0/24','197.234.240.0/22','198.41.128.0/17','198.177.56.0/23','198.202.211.0/24','198.217.251.0/24','198.252.206.0/24','199.5.242.0/24','199.27.128.0/21','199.33.230.0/23','199.33.232.0/23','199.60.103.0/24','199.181.197.0/24','200.73.67.0/24','202.27.69.0/24','202.82.250.0/24','203.6.66.0/24','203.6.74.0/24','203.13.32.0/24','203.17.126.0/24','203.19.222.0/24','203.22.223.0/24','203.22.241.0/24','203.23.103.0/24','203.23.104.0/24','203.23.106.0/24','203.24.102.0/23','203.24.108.0/23','203.28.8.0/23','203.29.52.0/22','203.30.188.0/22','203.32.120.0/23','203.34.28.0/24','203.34.80.0/24','203.55.107.0/24','203.89.5.0/24','203.168.128.0/22','203.168.192.0/20','204.62.141.0/24','204.68.111.0/24','204.69.207.0/24','204.153.16.0/24','204.195.192.0/18','205.233.181.0/24','207.189.149.0/24','208.42.188.0/24','208.77.33.0/24','208.77.35.0/24','208.88.71.0/24','208.100.60.0/24','209.46.30.0/24','209.55.226.0/24','209.55.232.0/24','209.55.234.0/24','209.55.246.0/23','209.55.253.0/24','209.55.254.0/24','209.222.114.0/23','212.6.39.0/24','212.22.76.0/24','212.104.128.0/24','212.239.86.0/24','213.182.199.0/24','213.219.247.0/24','213.241.198.0/24','216.19.107.0/24','216.74.106.0/24','216.120.131.0/24','216.120.180.0/23','216.154.208.0/20','216.163.179.0/24','216.198.53.0/24','216.198.54.0/24','216.205.52.0/24','216.224.121.0/24','223.27.176.0/23','2001:503:ff40::/46','2001:678:19c::/48','2001:df7:6e80::/48','2400:c760:a::/48','2400:cb00::/32','2405:8100::/32','2405:b500::/32','2407:30c0:180::/46','2602:80c:cf::/48','2602:f660::/40','2602:f830::/48','2606:2c0:20::/47','2606:2c40::/48','2606:4700::/32','2606:54c0::/32','2606:54c1::/48','2606:54c1:2::/47','2606:54c1:6::/47','2606:54c1:8::/46','2606:54c1:c::/47','2606:54c1:10::/46','2606:54c2::/47','2606:54c2:2::/48','2606:54c3::/45','2606:ae80:10::/48','2607:8940:2000::/35','2607:9240:201::/48','2607:9240:202::/47','2620:78:200f::/48','2620:cb:2000::/48','2620:117:bfb0::/44','2620:127:f00c::/46','2620:12c:90af::/48','2620:132:1000::/48','2803:f800::/32','2a02:d21:20::/44','2a03:f940::/48','2a05:7880::/32','2a06:98c0::/29','2a06:9ac0::/32','2a07:180::/32','2a08:600::/48','2a08:600:e0::/47','2a08:600:ee::/47','2a08:600:ff::/48','2a09:bac0:4::/48','2a09:bac0:11::/48','2a09:bac0:12::/48','2a09:bac0:14::/46','2a09:bac0:19::/48','2a09:bac0:20::/46','2a09:bac0:26::/47','2a09:bac0:28::/47','2a09:bac0:31::/48','2a09:bac0:34::/47','2a09:bac0:38::/47','2a09:bac0:40::/48','2a09:bac0:43::/48','2a09:bac0:44::/47','2a09:bac0:47::/48','2a09:bac0:48::/47','2a09:bac0:50::/48','2a09:bac0:52::/48','2a09:bac0:54::/48','2a09:bac0:57::/48','2a09:bac0:59::/48','2a09:bac0:63::/48','2a09:bac0:64::/46','2a09:bac0:68::/47','2a09:bac0:70::/46','2a09:bac0:74::/47','2a09:bac0:78::/47','2a09:bac0:80::/47','2a09:bac0:83::/48','2a09:bac0:84::/47','2a09:bac0:87::/48','2a09:bac0:88::/47','2a09:bac0:94::/48','2a09:bac0:96::/47','2a09:bac0:98::/48','2a09:bac0:100::/48','2a09:bac0:102::/47','2a09:bac0:106::/47','2a09:bac0:109::/48','2a09:bac0:113::/48','2a09:bac0:114::/47','2a09:bac0:116::/48','2a09:bac0:119::/48','2a09:bac0:120::/47','2a09:bac0:123::/48','2a09:bac0:124::/47','2a09:bac0:128::/48','2a09:bac0:130::/48','2a09:bac0:132::/48','2a09:bac0:134::/48','2a09:bac0:136::/47','2a09:bac0:138::/48','2a09:bac0:143::/48','2a09:bac0:145::/48','2a09:bac0:149::/48','2a09:bac0:151::/48','2a09:bac0:152::/47','2a09:bac0:154::/47','2a09:bac0:156::/48','2a09:bac0:158::/47','2a09:bac0:160::/48','2a09:bac0:162::/48','2a09:bac0:165::/48','2a09:bac0:166::/47','2a09:bac0:168::/47','2a09:bac0:172::/48','2a09:bac0:174::/48','2a09:bac0:181::/48','2a09:bac0:185::/48','2a09:bac0:192::/47','2a09:bac0:194::/48','2a09:bac0:196::/47','2a09:bac0:199::/48','2a09:bac0:202::/47','2a09:bac0:212::/48','2a09:bac0:216::/47','2a09:bac0:218::/48','2a09:bac0:227::/48','2a09:bac0:228::/48','2a09:bac0:237::/48','2a09:bac0:243::/48','2a09:bac0:246::/48','2a09:bac0:254::/48','2a09:bac0:268::/47','2a09:bac0:270::/48','2a09:bac0:275::/48','2a09:bac0:281::/48','2a09:bac0:282::/47','2a09:bac0:284::/47','2a09:bac0:298::/47','2a09:bac0:301::/48','2a09:bac0:337::/48','2a09:bac0:338::/47','2a09:bac0:341::/48','2a09:bac0:343::/48','2a09:bac0:346::/48','2a09:bac0:352::/48','2a09:bac0:358::/48','2a09:bac0:360::/48','2a09:bac0:374::/48','2a09:bac0:376::/48','2a09:bac0:380::/47','2a09:bac0:382::/48','2a09:bac0:384::/47','2a09:bac0:388::/48','2a09:bac0:390::/47','2a09:bac0:393::/48','2a09:bac0:403::/48','2a09:bac0:404::/48','2a09:bac0:407::/48','2a09:bac0:408::/48','2a09:bac0:411::/48','2a09:bac0:412::/48','2a09:bac0:423::/48','2a09:bac0:428::/48','2a09:bac0:431::/48','2a09:bac0:439::/48','2a09:bac0:441::/48','2a09:bac0:445::/48','2a09:bac0:448::/48','2a09:bac0:450::/48','2a09:bac0:453::/48','2a09:bac0:455::/48','2a09:bac0:458::/48','2a09:bac0:462::/48','2a09:bac0:464::/48','2a09:bac0:466::/47','2a09:bac0:470::/48','2a09:bac0:472::/48','2a09:bac0:476::/47','2a09:bac0:478::/48','2a09:bac0:481::/48','2a09:bac0:483::/48','2a09:bac0:485::/48','2a09:bac0:497::/48','2a09:bac0:507::/48','2a09:bac0:522::/47','2a09:bac0:525::/48','2a09:bac0:532::/47','2a09:bac0:534::/48','2a09:bac0:537::/48','2a09:bac0:538::/48','2a09:bac0:542::/47','2a09:bac0:557::/48','2a09:bac0:558::/47','2a09:bac0:566::/47','2a09:bac0:572::/47','2a09:bac0:574::/48','2a09:bac0:581::/48','2a09:bac0:582::/47','2a09:bac0:594::/48','2a09:bac0:597::/48','2a09:bac0:598::/48','2a09:bac0:601::/48','2a09:bac0:612::/48','2a09:bac0:618::/47','2a09:bac0:626::/48','2a09:bac0:631::/48','2a09:bac0:632::/47','2a09:bac0:636::/47','2a09:bac0:641::/48','2a09:bac0:646::/48','2a09:bac0:649::/48','2a09:bac0:650::/48','2a09:bac0:658::/48','2a09:bac0:663::/48','2a09:bac0:670::/48','2a09:bac0:677::/48','2a09:bac0:679::/48','2a09:bac0:684::/48','2a09:bac0:694::/48','2a09:bac0:704::/48','2a09:bac0:711::/48','2a09:bac0:712::/48','2a09:bac0:719::/48','2a09:bac0:721::/48','2a09:bac0:724::/47','2a09:bac0:735::/48','2a09:bac0:745::/48','2a09:bac0:748::/48','2a09:bac0:920::/48','2a09:bac0:1000::/47','2a09:bac0:1008::/45','2a09:bac1::/32','2a09:bac2::/31','2a09:bac4::/30','2a0a:6c80::/29','2a0b:4144::/48','2a0b:85c7:ffff::/48','2a13:9500:3e::/48','2a14:7ac0::/48','2a14:a087::/47','2c0f:f248::/32'
];

const cacheMap = new Map();
const CACHE_TTL = 3600 * 1000;        // 归属缓存 1 小时
const ECH_CACHE_TTL = 1200 * 1000;     // ECH 缓存 20 分钟

let compiledMeta = null, compiledCF = null;
function getCompiledMeta() { if (!compiledMeta) compiledMeta = compileCidrs(RAW_META_CIDRS); return compiledMeta; }
function getCompiledCF()   { if (!compiledCF)   compiledCF   = compileCidrs(RAW_CF_CIDRS);   return compiledCF; }

// ===================== Worker 入口 =====================
export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url);
        const clientIP = url.searchParams.get('clientIp')
            || req.headers.get('X-Client-IP')
            || req.headers.get('CF-Connecting-IP')
            || '';
        if (url.pathname === '/api/query') return handleApiQuery(url, clientIP);
        if (url.pathname === '/ech') return handleDoHRequest(req, true, ctx, clientIP);
        if (url.pathname === '/doh') return handleDoHRequest(req, false, ctx, clientIP);
        return new Response(getHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
};

// ===================== DoH 处理 =====================
async function handleDoHRequest(req, injectEch, ctx, clientIP) {
    const url = new URL(req.url);
    const config = {
        ip4:        url.searchParams.get('ip4')     || req.headers.get('X-Ip4')     || '',
        ip6:        url.searchParams.get('ip6')     || req.headers.get('X-Ip6')     || '',
        metaIp4:    url.searchParams.get('metaIp4') || req.headers.get('X-MetaIp4') || '',
        metaIp6:    url.searchParams.get('metaIp6') || req.headers.get('X-MetaIp6') || '',
        cfDomain:   url.searchParams.get('cf')      || req.headers.get('X-CF')      || '',
        metaDomain: url.searchParams.get('meta')    || req.headers.get('X-Meta')    || '',
        echDomain:  url.searchParams.get('ech')     || req.headers.get('X-ECH')     || 'cloudflare-ech.com',
        best:       url.searchParams.get('best')    || req.headers.get('X-Best')    || 'false'
    };

    if (req.method === 'POST') {
        const buf = await req.arrayBuffer();
        if (injectEch) return handleDnsQuery(buf, config, ctx, clientIP);
        const res = await forwardQuery(buf);
        return dnsResponse(await res.arrayBuffer());
    }
    if (req.method === 'GET' && url.searchParams.get('dns')) {
        const raw = url.searchParams.get('dns').replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
        const buf = Uint8Array.from(atob(raw), c => c.charCodeAt(0)).buffer;
        if (injectEch) return handleDnsQuery(buf, config, ctx, clientIP);
        const res = await forwardQuery(buf);
        return dnsResponse(await res.arrayBuffer());
    }
    return new Response('OK', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
}

// ===================== DNS 核心（ECH 注入） =====================
async function handleDnsQuery(rawBuffer, config, ctx, clientIP) {
    try {
        const query = parseDnsPacket(rawBuffer);
        if (!query || query.questions.length === 0) return forwardQuery(rawBuffer);
        const { id, questions } = query;
        const qType = questions[0].type;
        const qName = questions[0].name.toLowerCase().replace(/\.$/, "");

        // 假名处理
        if (qName === "cf.ech" || qName === "fb.ech") {
            if (qType === 65) {
                const randomTtl = Math.floor(Math.random() * (10800 - 7200 + 1)) + 7200;
                let echRdata;
                if (qName === "cf.ech") {
                    echRdata = await buildCFEchResponse(config, qName, clientIP);
                } else {
                    echRdata = await buildMetaEchResponse(config, qName, clientIP);
                }
                return dnsResponse(createMultiAnsResponse(id, qName, 65, echRdata ? [echRdata] : [], echRdata ? randomTtl : 60));
            } else {
                return dnsResponse(createMultiAnsResponse(id, qName, qType, [], 3600));
            }
        }

        const isStaticCF = CF_STATIC_DOMAINS.some(d => qName === d || qName.endsWith("." + d));
        const isStaticMeta = META_DOMAINS.some(d => qName === d || qName.endsWith("." + d));

        if (isStaticCF || isStaticMeta) {
            const result = await resolveDNS(qName, qType === 28 ? 'AAAA' : (qType === 65 ? 'HTTPS' : 'A'), config, clientIP);
            return dnsResponseFromResult(id, qName, qType, result);
        }

        // 非静态域名
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
        const rdata = [];
        if (result.ech) {
            const params = [{ key: 'alpn', val: 'h2,h3' }, { key: 'ech', val: result.ech }];
            const packed = packHttpsParamsWithHints(1, ".", params, result.ipv4hints || [], result.ipv6hints || []);
            rdata.push(packed);
        }
        return dnsResponse(createMultiAnsResponse(id, qName, 65, rdata, rdata.length ? 300 : 60));
    } else {
        const bytes = qType === 28 ? ipv6ToBytes : ipToBytes;
        const answers = (result.answers || []).map(bytes);
        return dnsResponse(createMultiAnsResponse(id, qName, qType, answers, 300));
    }
}

// ===================== JSON API =====================
async function handleApiQuery(url, clientIP) {
    const domain = url.searchParams.get('domain');
    const type = url.searchParams.get('type')?.toUpperCase() || 'A';
    if (!domain) return json({ error: '缺少 domain' }, 400);
    if (!['A', 'AAAA', 'HTTPS'].includes(type)) return json({ error: '类型不支持' }, 400);

    const config = {
        ip4:        url.searchParams.get('ip4')     || '',
        ip6:        url.searchParams.get('ip6')     || '',
        metaIp4:    url.searchParams.get('metaIp4') || '',
        metaIp6:    url.searchParams.get('metaIp6') || '',
        cfDomain:   url.searchParams.get('cf')      || '',
        metaDomain: url.searchParams.get('meta')    || '',
        echDomain:  url.searchParams.get('ech')     || 'cloudflare-ech.com',
        best:       url.searchParams.get('best')    || 'false'
    };

    try {
        const result = await resolveDNS(domain, type, config, clientIP);
        return json(result);
    } catch (e) {
        return json({ error: e.message }, 500);
    }
}

// ===================== 核心：resolveDNS =====================
async function resolveDNS(domain, type, config, clientIP) {
    domain = domain.toLowerCase().replace(/\.$/, '');
    const best = config.best === 'true';

    const origStaticCF = CF_STATIC_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
    const origStaticMeta = META_DOMAINS.some(d => domain === d || domain.endsWith("." + d));

    let effectiveCF = origStaticCF;
    let effectiveMeta = origStaticMeta;

    if (!origStaticCF && !origStaticMeta && best) {
        const probe = await activeProbeOwner(domain, null, clientIP);
        if (probe) {
            if (probe.owner === 'CF') effectiveCF = true;
            else if (probe.owner === 'META') effectiveMeta = true;
        }
    }

    const isStatic = effectiveCF || effectiveMeta;

    if (isStatic) {
        return handleStaticDomain(domain, type, config, effectiveCF, effectiveMeta, clientIP);
    }

    // 非静态域名：纯上游，不替换
    const dnsType = type === 'HTTPS' ? 65 : (type === 'AAAA' ? 28 : 1);
    const upstreamData = await queryUpstreamDNS(domain, dnsType, clientIP);
    if (!upstreamData) return { domain, type, error: '上游查询失败' };

    let answers = [];
    let ech = null;
    if (upstreamData.Answer) {
        if (type === 'HTTPS') {
            const rec = upstreamData.Answer.find(r => r.type === 65);
            if (rec) {
                const parsed = parseHttpsRecord(rec.data);
                if (parsed && parsed.ech) ech = parsed.ech;
            }
        } else {
            answers = upstreamData.Answer.filter(r => r.type === dnsType).map(r => r.data);
        }
    }

    const owner = (await activeProbeOwner(domain, null, clientIP))?.owner || null;

    if (!ech && type === 'HTTPS') {
        if (owner === 'META') ech = META_ECH_CONFIG;
        else if (owner === 'CF') ech = await fetchRealEch(config.echDomain || 'cloudflare-ech.com', clientIP);
    }

    let ipv4Hints = [], ipv6Hints = [];
    if (type === 'HTTPS' && (owner === 'CF' || owner === 'META')) {
        const [aData, aaaaData] = await Promise.all([
            queryUpstreamDNS(domain, 1, clientIP).catch(() => null),
            queryUpstreamDNS(domain, 28, clientIP).catch(() => null)
        ]);
        if (aData?.Answer) ipv4Hints = aData.Answer.filter(r => r.type === 1).map(r => r.data);
        if (aaaaData?.Answer) ipv6Hints = aaaaData.Answer.filter(r => r.type === 28).map(r => r.data);
        ipv4Hints = [...new Set(ipv4Hints)].slice(0, 6);
        ipv6Hints = [...new Set(ipv6Hints)].slice(0, 6);
    }

    const result = { domain, type, answers, ech: ech || null };
    if (type === 'HTTPS') {
        if (ipv4Hints.length) result.ipv4hints = ipv4Hints;
        if (ipv6Hints.length) result.ipv6hints = ipv6Hints;
    }
    return result;
}

// ===================== 统一静态域名处理 =====================
async function handleStaticDomain(domain, type, config, isCF, isMeta, clientIP) {
    const owner = isCF ? 'CF' : 'META';

    if (type === 'AAAA') {
        if (isDomainIpv4Only(domain)) return { domain, type, answers: [], ech: null };
        const ips = await applyIPPreference(
            type,
            isCF ? config.ip6 : config.metaIp6,
            isCF ? config.cfDomain : config.metaDomain,
            isCF ? DEFAULT_CF_IP6 : '',
            clientIP
        );
        return { domain, type, answers: ips, ech: null };
    }

    if (type === 'HTTPS') {
        const ipv4Hints = await collectHints(1, config, isCF, clientIP);
        const ipv6Hints = !isDomainIpv4Only(domain) ? await collectHints(28, config, isCF, clientIP) : [];
        const ech = isCF ? await fetchRealEch(config.echDomain || 'cloudflare-ech.com', clientIP) : META_ECH_CONFIG;
        const result = { domain, type, answers: [] };
        result.ech = ech || null;
        if (ipv4Hints.length) result.ipv4hints = ipv4Hints;
        if (ipv6Hints.length) result.ipv6hints = ipv6Hints;
        return result;
    }

    // A 记录
    const ips = await applyIPPreference(
        type,
        isCF ? config.ip4 : config.metaIp4,
        isCF ? config.cfDomain : config.metaDomain,
        isCF ? DEFAULT_CF_IP : DEFAULT_META_IP,
        clientIP
    );
    return { domain, type, answers: ips, ech: null };
}

// 公共 IP 优选：自定义 IP > 多域名解析 > 默认 IP
async function applyIPPreference(type, customIP, resolveDomain, defaultIP, clientIP) {
    if (customIP) return parseIpList(customIP);
    if (resolveDomain) {
        const resolved = await resolveMultiDomainToIps(resolveDomain, type === 'AAAA' ? 28 : 1, clientIP);
        if (resolved.length > 0) {
            return resolved.map(ip => type === 'AAAA' ? formatIPv6FromBytes(ip) : bytesToIp(ip));
        }
    }
    return defaultIP ? parseIpList(defaultIP) : [];
}

// 收集 HTTPS hints
async function collectHints(type, config, isCF, clientIP) {
    if (type === 1) {
        if (isCF && config.ip4) return parseIpList(config.ip4);
        if (!isCF && config.metaIp4) return parseIpList(config.metaIp4);
        const resolveParam = isCF ? config.cfDomain : config.metaDomain;
        if (resolveParam) {
            const resolved = await resolveMultiDomainToIps(resolveParam, 1, clientIP);
            if (resolved.length > 0) return resolved.map(bytesToIp);
        }
        return isCF ? [DEFAULT_CF_IP] : [DEFAULT_META_IP];
    } else { // IPv6
        if (isCF && config.ip6) return parseIpList(config.ip6);
        if (!isCF && config.metaIp6) return parseIpList(config.metaIp6);
        const resolveParam = isCF ? config.cfDomain : config.metaDomain;
        if (resolveParam) {
            const resolved = await resolveMultiDomainToIps(resolveParam, 28, clientIP);
            if (resolved.length > 0) return resolved.map(formatIPv6FromBytes);
        }
        return isCF ? parseIpList(DEFAULT_CF_IP6) : [];
    }
}

// ===================== 假名 ECH 打包 =====================
async function buildCFEchResponse(config, domain, clientIP) {
    const ipv4Hints = await collectHints(1, config, true, clientIP);
    const ipv6Hints = !isDomainIpv4Only(domain) ? await collectHints(28, config, true, clientIP) : [];
    const ech = await fetchRealEch(config.echDomain || 'cloudflare-ech.com', clientIP);
    if (!ech) return null;
    return packHttpsParamsWithHints(1, ".", [
        { key: 'alpn', val: 'h2,h3' },
        { key: 'ech', val: ech }
    ], ipv4Hints, ipv6Hints);
}

async function buildMetaEchResponse(config, domain, clientIP) {
    const ipv4Hints = await collectHints(1, config, false, clientIP);
    const ipv6Hints = !isDomainIpv4Only(domain) ? await collectHints(28, config, false, clientIP) : [];
    return packHttpsParamsWithHints(1, ".", [
        { key: 'alpn', val: 'h2,h3' },
        { key: 'ech', val: META_ECH_CONFIG }
    ], ipv4Hints, ipv6Hints);
}

// ===================== 工具函数 =====================
function parseIpList(raw) {
    if (!raw) return [];
    raw = raw.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return arr.map(String).filter(s => s);
        } catch {}
    }
    return raw.split(',').map(s => s.trim()).filter(s => s);
}

async function resolveMultiDomainToIps(domainsStr, type, clientIP) {
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
    if (type === 1) return Array.from(allIps).map(ipToBytes);
    else return Array.from(allIps).map(ipv6ToBytes);
}

async function resolveDomainToIp(domain, type = 1, clientIP) {
    const data = await queryUpstreamDNS(domain, type, clientIP);
    if (data && data.Answer) {
        return data.Answer.filter(r => r.type === type).map(r => r.data);
    }
    return [];
}

async function queryUpstreamDNS(name, type, clientIP = '') {
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

    const urls = [UPSTREAM_JSON_GOOGLE + '?' + params.toString(), UPSTREAM_JSON_ALI + '?' + params.toString()];
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

async function fetchRealEch(echDomain, clientIP) {
    const cacheKey = `ech:${echDomain}`;
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expire) return cached.value;
    try {
        const data = await queryUpstreamDNS(echDomain, 65, clientIP);
        if (data && data.Answer) {
            const rec = data.Answer.find(r => r.type === 65);
            if (rec) {
                const parsed = parseHttpsRecord(rec.data);
                if (parsed && parsed.ech) {
                    cacheMap.set(cacheKey, { value: parsed.ech, expire: Date.now() + ECH_CACHE_TTL });
                    return parsed.ech;
                }
            }
        }
    } catch {}
    return null;
}

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

function packHttpsParamsWithHints(priority, target, params, ipv4Hints, ipv6Hints) {
    if (ipv4Hints && ipv4Hints.length > 0) {
        const unique = [...new Set(ipv4Hints)].slice(0, 6);
        if (unique.length > 0) params.push({ key: 'ipv4hint', val: unique.join(',') });
    }
    if (ipv6Hints && ipv6Hints.length > 0) {
        const unique = [...new Set(ipv6Hints)].slice(0, 6);
        if (unique.length > 0) params.push({ key: 'ipv6hint', val: unique.join(',') });
    }
    return packHttpsParams(priority, target, params);
}

function isDomainIpv4Only(domain) {
    return IPV4_ONLY_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

// 二进制 DNS 工具
async function forwardQuery(body) {
    const reqInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/dns-message', 'Accept': 'application/dns-message' },
        body
    };
    const pGoogle = fetch(UPSTREAM_DNS_GOOGLE, reqInit).then(res => res.ok ? res : Promise.reject());
    const pAli = fetch(UPSTREAM_DNS_ALI, reqInit).then(res => res.ok ? res : Promise.reject());
    try { return await Promise.any([pGoogle, pAli]); } catch { return fetch(UPSTREAM_DNS_GOOGLE, reqInit); }
}

function dnsResponse(buffer) {
    return new Response(buffer, {
        headers: { 'Content-Type': 'application/dns-message', 'Access-Control-Allow-Origin': '*' }
    });
}

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

function encodeSvcParam(key, value) {
    const ids = { 'alpn': 1, 'ech': 5, 'ipv4hint': 4, 'ipv6hint': 6 };
    const id = ids[key];
    if (!id) return null;
    let valBuf;
    if (key === 'alpn' || key === 'ipv4hint' || key === 'ipv6hint') {
        const parts = value.split(',');
        if (key === 'alpn') {
            valBuf = new Uint8Array(parts.reduce((a, b) => a + b.length + 1, 0));
            let o = 0;
            for (const p of parts) {
                valBuf[o++] = p.length;
                for (let i = 0; i < p.length; i++) valBuf[o++] = p.charCodeAt(i);
            }
        } else if (key === 'ipv4hint') {
            valBuf = new Uint8Array(parts.length * 4);
            let offset = 0;
            for (const ip of parts) {
                const bytes = ipToBytes(ip.trim());
                valBuf.set(bytes, offset);
                offset += 4;
            }
        } else if (key === 'ipv6hint') {
            valBuf = new Uint8Array(parts.length * 16);
            let offset = 0;
            for (const ip of parts) {
                const bytes = ipv6ToBytes(ip.trim());
                valBuf.set(bytes, offset);
                offset += 16;
            }
        }
    } else {
        const s = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
        valBuf = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) valBuf[i] = s.charCodeAt(i);
    }
    const res = new Uint8Array(4 + valBuf.length);
    const v = new DataView(res.buffer);
    v.setUint16(0, id);
    v.setUint16(2, valBuf.length);
    res.set(valBuf, 4);
    return res;
}

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

async function getOwnerFromCache(name) {
    if (cacheMap.has(name)) {
        const item = cacheMap.get(name);
        if (Date.now() < item.expire) return item.val;
        cacheMap.delete(name);
    }
    return null;
}

function setOwnerCache(name, owner, ctx) {
    cacheMap.set(name, { val: owner, expire: Date.now() + CACHE_TTL });
}

async function activeProbeOwner(domain, ctx, clientIP) {
    const cacheKey = `owner:${domain}`;
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expire) return cached.value;

    try {
        const data = await queryUpstreamDNS(domain, 1, clientIP);
        if (data && data.Answer) {
            const ips = data.Answer.filter(r => r.type === 1).map(r => r.data);
            for (const ip of ips) {
                if (isIpInCidrs(ip, getCompiledMeta())) {
                    const result = { owner: 'META', ips };
                    cacheMap.set(cacheKey, { value: result, expire: Date.now() + CACHE_TTL });
                    return result;
                }
                if (isIpInCidrs(ip, getCompiledCF())) {
                    const result = { owner: 'CF', ips };
                    cacheMap.set(cacheKey, { value: result, expire: Date.now() + CACHE_TTL });
                    return result;
                }
            }
        }
    } catch {}
    cacheMap.set(cacheKey, { value: null, expire: Date.now() + 60000 });
    return null;
}

// ===================== 前端页面 =====================
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
            --accent: #38bdf8;
            --accent-glow: rgba(56, 189, 248, 0.15);
            --border: #1e293b;
            --input-bg: #0f172a;
            --cf: #f6821f;
            --meta: #0668e1;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
            background-image: radial-gradient(ellipse at top, rgba(56, 189, 248, 0.08) 0%, transparent 60%);
        }
        .container {
            background: var(--card);
            border-radius: 20px;
            padding: 2.5rem;
            width: 100%;
            max-width: 580px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
        }
        .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 0.75rem;
        }
        .logo {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--accent), #818cf8);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
        }
        h1 { 
            font-size: 1.5rem; 
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent), #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle { 
            color: var(--text-secondary); 
            font-size: 0.75rem; 
            margin-bottom: 2rem;
            margin-left: 52px;
        }
        label { 
            font-size: 0.85rem; 
            font-weight: 500;
            display: block; 
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        input, select {
            width: 100%;
            padding: 0.8rem 1rem;
            margin-bottom: 1.2rem;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 10px;
            color: var(--text);
            font-size: 0.75rem;
            transition: border-color 0.2s, box-shadow 0.2s;
            font-family: inherit;
        }
        input:focus, select:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }
        select {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            padding-right: 2.5rem;
        }
        .row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        button {
            width: 100%;
            padding: 0.9rem 1rem;
            background: linear-gradient(135deg, var(--accent), #6366f1);
            color: #fff;
            font-weight: 600;
            font-size: 1rem;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
            margin-top: 0.5rem;
        }
        button:hover { 
            transform: translateY(-1px); 
            box-shadow: 0 8px 25px rgba(56, 189, 248, 0.3);
        }
        button:active { transform: translateY(0); }
        button:disabled { 
            opacity: 0.5; 
            cursor: not-allowed; 
            transform: none;
            box-shadow: none;
        }
        .result-box {
            background: var(--input-bg);
            border-radius: 12px;
            padding: 1.2rem;
            margin-top: 1.2rem;
            word-break: break-all;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.85rem;
            min-height: 60px;
            border: 1px solid var(--border);
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
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
            border: 2px solid var(--accent);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .result-box.error { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
        .badge {
            display: inline-block;
            padding: 0.2rem 0.6rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 8px;
        }
        .badge-cf { background: rgba(246, 130, 31, 0.15); color: var(--cf); }
        .badge-meta { background: rgba(6, 104, 225, 0.15); color: var(--meta); }
        .advanced-section {
            margin: 1.5rem 0;
            padding: 1.2rem;
            background: var(--input-bg);
            border-radius: 12px;
            border: 1px solid var(--border);
            display: none;
        }
        .advanced-section.show { display: block; }
        .advanced-section .param-group { display: none; }
        .advanced-section .param-group.active { display: block; }
        .advanced-section input { margin-bottom: 0.8rem; }
        .advanced-section input:last-child { margin-bottom: 0; }
        .footer {
            text-align: center;
            margin-top: 1.5rem;
            color: var(--text-secondary);
            font-size: 0.75rem;
        }
        .global-section {
            margin: 1rem 0;
            padding: 1rem;
            background: var(--input-bg);
            border-radius: 12px;
            border: 1px solid var(--border);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔒</div>
            <h1>DOH-ECH 查询</h1>
        </div>
        <p class="subtitle">智能 DNS 解析 · ECH 注入 · ECS 就近解析</p>
        <label for="domain">查询域名</label>
        <input type="text" id="domain" placeholder="输入域名，例如 twitter.com" value="twitter.com" autofocus>
<div class="row">
    <div>
        <label for="type">记录类型</label>
        <select id="type">
            <option value="A">A (IPv4)</option>
            <option value="AAAA">AAAA (IPv6)</option>
            <option value="HTTPS">HTTPS (ECH)</option>
        </select>
    </div>
    <div>
        <label for="mode">优选模式</label>
        <select id="mode" onchange="onModeChange()">
            <option value="">无 (默认解析)</option>
            <option value="cf">🔶 CF 优选</option>
            <option value="meta">🔵 Meta 优选</option>
        </select>
    </div>
</div>
<div class="global-section">
    <label for="best">全局跟随优选结果</label>
    <select id="best" style="margin-bottom:0">
        <option value="false">否 (仅固定域名)</option>
        <option value="true">是 (所有 CF/Meta 域名)</option>
    </select>
</div>
<div id="cfParams" class="advanced-section">
    <div class="param-group active" id="cfGroup">
        <label>Cloudflare IPv4 <span class="badge badge-cf">ip4</span></label>
        <input type="text" id="ip4" placeholder="1.2.3.4, 5.6.7.8">
        <label>Cloudflare IPv6 <span class="badge badge-cf">ip6</span></label>
        <input type="text" id="ip6" placeholder="2606:4700::, 2606:4700::1">
        <label>CF优选域名 <span class="badge badge-cf">cf</span></label>
        <input type="text" id="cfDomain" placeholder="example.com, example2.com">
        <label>ECH来源 外层SNI <span class="badge badge-cf">ech</span></label>
        <input type="text" id="echDomain" placeholder="cloudflare-ech.com">
    </div>
</div>
<div id="metaParams" class="advanced-section">
    <div class="param-group active" id="metaGroup">
        <label>Meta IPv4 <span class="badge badge-meta">metaIp4</span></label>
        <input type="text" id="metaIp4" placeholder="157.240.1.1, 157.240.2.1">
        <label>Meta IPv6 <span class="badge badge-meta">metaIp6</span></label>
        <input type="text" id="metaIp6" placeholder="2a03:2880:...">
        <label>Meta优选域名 <span class="badge badge-meta">meta</span></label>
        <input type="text" id="metaDomain" placeholder="meta-better.example.com">
    </div>
</div>
<div class="global-section">
    <label for="clientIp">自定义 Client IP (ECS) <span style="font-weight:normal;font-size:0.8em;">留空自动获取</span></label>
    <input type="text" id="clientIp" placeholder="1.2.4.0/24 或 ::/56" style="margin-bottom:0">
</div>
<button id="queryBtn" onclick="doQuery()">
            <span id="btnText">🔍 开始查询</span>
        </button>
        <div id="result" class="result-box" style="display: none;"></div>
        <div class="footer">GitHub@rosenii · DOH-ECH · Cloudflare Pages</div>
    </div>
    <script>
        function onModeChange() {
            const mode = document.getElementById('mode').value;
            document.getElementById('cfParams').classList.toggle('show', mode === 'cf');
            document.getElementById('metaParams').classList.toggle('show', mode === 'meta');
        }
async function doQuery() {
    const domain = document.getElementById('domain').value.trim();
    const type = document.getElementById('type').value;
    const mode = document.getElementById('mode').value;
    const btn = document.getElementById('queryBtn');
    const btnText = document.getElementById('btnText');
    const resultDiv = document.getElementById('result');
    if (!domain) {
        resultDiv.innerHTML = '<span class="error">请输入域名</span>';
        resultDiv.className = 'result-box error';
        resultDiv.style.display = 'block';
        return;
    }
    const params = new URLSearchParams();
    params.set('domain', domain);
    params.set('type', type);
    // 全局 best
    const best = document.getElementById('best').value;
    params.set('best', best);

    if (mode === 'cf') {
        const ip4 = document.getElementById('ip4').value.trim();
        const ip6 = document.getElementById('ip6').value.trim();
        const cfDomain = document.getElementById('cfDomain').value.trim();
        const echDomain = document.getElementById('echDomain').value.trim();
        if (ip4) params.set('ip4', ip4);
        if (ip6) params.set('ip6', ip6);
        if (cfDomain) params.set('cf', cfDomain);
        if (echDomain) params.set('ech', echDomain);
    } else if (mode === 'meta') {
        const metaIp4 = document.getElementById('metaIp4').value.trim();
        const metaIp6 = document.getElementById('metaIp6').value.trim();
        const metaDomain = document.getElementById('metaDomain').value.trim();
        if (metaIp4) params.set('metaIp4', metaIp4);
        if (metaIp6) params.set('metaIp6', metaIp6);
        if (metaDomain) params.set('meta', metaDomain);
    }
    const clientIp = document.getElementById('clientIp').value.trim();
    if (clientIp) params.set('clientIp', clientIp);

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
    </script>
</body>
</html>`;
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}
