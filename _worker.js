/**
 * Total-ECH Pages 版 (单文件 _worker.js)
 * 包含前端查询页面 + 双上游 DNS API
 */

// ========== 配置 ==========
const UPSTREAM_JSON_GOOGLE = 'https://dns.google/resolve';
const UPSTREAM_JSON_ALI = 'https://dns.alidns.com/resolve';

const TWITTER_DOMAINS = [
    "twimg.com", "twitter.com", "x.com", "t.co",
    "cloudflare-dns.com", "pages.dev", "workers.dev", "cloudflare.com", "lss1.ccwu.cc"
];
const DEFAULT_TWITTER_IP = "104.18.10.118";

const META_DOMAINS = [
    "facebook.com", "messenger.com", "instagram.com",
    "whatsapp.com", "fb.com", "meta.com"
];
const DEFAULT_META_IP = "157.240.1.35";

const META_ECH_CONFIG = "AEj+DQBEAQAgACAdd+scUi0IYFsXnUIU7ko2Nd9+F8M26pAGZVpz/KrWPgAEAAEAAWQVZWNoLXB1YmxpYy5hdG1ldGEuY29tAAA=";

// ⚠️ 请替换为您的完整 CIDR 列表
const RAW_META_CIDRS = [ /* 您的 Meta CIDR */ ];
const RAW_CF_CIDRS   = [ /* 您的 Cloudflare CIDR */ ];

const CACHE_TTL = 3600 * 1000;
const cacheMap = new Map();

let compiledMeta = null;
let compiledCF = null;
function getCompiledMeta() {
    if (!compiledMeta) compiledMeta = compileCidrs(RAW_META_CIDRS);
    return compiledMeta;
}
function getCompiledCF() {
    if (!compiledCF) compiledCF = compileCidrs(RAW_CF_CIDRS);
    return compiledCF;
}

// ========== Worker 入口 ==========
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        // API 路由
        if (url.pathname === '/api/query') {
            return handleApiQuery(url);
        }
        // 其他路径返回前端页面
        return new Response(getHtml(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
};

// ========== API 处理 ==========
async function handleApiQuery(url) {
    const domain = url.searchParams.get('domain');
    const type = url.searchParams.get('type')?.toUpperCase() || 'A';

    if (!domain) {
        return json({ error: '缺少 domain 参数' }, 400);
    }
    if (!['A', 'AAAA', 'HTTPS'].includes(type)) {
        return json({ error: '不支持的类型' }, 400);
    }

    try {
        const result = await resolveDNS(domain, type);
        return json(result);
    } catch (err) {
        return json({ error: err.message }, 500);
    }
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}

// ========== DNS 核心逻辑 ==========
async function resolveDNS(domain, type) {
    domain = domain.toLowerCase().replace(/\.$/, '');

    const isTwitter = TWITTER_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
    const isMeta = META_DOMAINS.some(d => domain === d || domain.endsWith("." + d));

    if (isTwitter || isMeta) {
        if (type === 'AAAA') return { domain, type, answers: [], ech: null };
        if (type === 'HTTPS') {
            const ech = isTwitter ? await fetchRealEch('cloudflare-ech.com') : META_ECH_CONFIG;
            return { domain, type, answers: [], ech: ech || null };
        }
        const ip = isTwitter ? DEFAULT_TWITTER_IP : DEFAULT_META_IP;
        return { domain, type, answers: [ip], ech: null };
    }

    const dnsType = type === 'HTTPS' ? 65 : (type === 'AAAA' ? 28 : 1);
    const data = await queryUpstreamDNS(domain, dnsType);
    if (!data) return { domain, type, error: '上游 DNS 全部查询失败' };

    let answers = [];
    let ech = null;

    if (data.Answer) {
        if (type === 'HTTPS') {
            const httpsRecord = data.Answer.find(r => r.type === 65);
            if (httpsRecord) {
                const parsed = parseHttpsRecord(httpsRecord.data);
                if (parsed && parsed.ech) ech = parsed.ech;
            }
        } else {
            answers = data.Answer.filter(r => r.type === dnsType).map(r => r.data);
        }
    }

    const owner = await detectOwner(domain);
    if (!ech && type === 'HTTPS') {
        if (owner === 'META') ech = META_ECH_CONFIG;
        else if (owner === 'CF') ech = await fetchRealEch('cloudflare-ech.com');
    }

    return { domain, type, answers, ech: ech || null };
}

async function queryUpstreamDNS(name, type) {
    const params = `?name=${encodeURIComponent(name)}&type=${type}`;
    const urls = [UPSTREAM_JSON_GOOGLE + params, UPSTREAM_JSON_ALI + params];

    const promises = urls.map(url =>
        fetch(url, { headers: { 'Accept': 'application/dns-json' } })
            .then(res => res.ok ? res.json() : Promise.reject())
    );

    try {
        return await Promise.any(promises);
    } catch (e) {
        try {
            const res = await fetch(urls[0], { headers: { 'Accept': 'application/dns-json' } });
            if (res.ok) return res.json();
        } catch {}
        return null;
    }
}

async function fetchRealEch(echDomain) {
    const cacheKey = `ech:${echDomain}`;
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expire) return cached.value;

    try {
        const data = await queryUpstreamDNS(echDomain, 65);
        if (data && data.Answer) {
            const rec = data.Answer.find(r => r.type === 65);
            if (rec) {
                const parsed = parseHttpsRecord(rec.data);
                if (parsed && parsed.ech) {
                    cacheMap.set(cacheKey, { value: parsed.ech, expire: Date.now() + 600_000 });
                    return parsed.ech;
                }
            }
        }
    } catch (e) { /* ignore */ }
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

async function detectOwner(domain) {
    const cacheKey = `owner:${domain}`;
    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() < cached.expire) return cached.value;

    try {
        const data = await queryUpstreamDNS(domain, 1);
        if (data && data.Answer) {
            for (const rec of data.Answer) {
                if (rec.type === 1) {
                    const ip = rec.data;
                    if (isIpInCidrs(ip, getCompiledMeta())) {
                        cacheMap.set(cacheKey, { value: 'META', expire: Date.now() + CACHE_TTL });
                        return 'META';
                    }
                    if (isIpInCidrs(ip, getCompiledCF())) {
                        cacheMap.set(cacheKey, { value: 'CF', expire: Date.now() + CACHE_TTL });
                        return 'CF';
                    }
                }
            }
        }
    } catch (e) { /* ignore */ }
    cacheMap.set(cacheKey, { value: null, expire: Date.now() + 60_000 });
    return null;
}

// ========== CIDR 工具函数 ==========
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
        } catch (e) {}
    } else {
        try {
            const ipNum = ipToLong(ip);
            return compiled.v4.some(r => ipNum >= r.start && ipNum <= r.end);
        } catch (e) {}
    }
    return false;
}

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

// ========== 前端页面 ==========
function getHtml() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ECH DNS 查询</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --text: #e2e8f0;
            --accent: #38bdf8;
            --border: #334155;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            background: var(--card);
            border-radius: 16px;
            padding: 2rem;
            width: 100%;
            max-width: 500px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .subtitle { color: #94a3b8; font-size: 0.85rem; margin-bottom: 2rem; }
        label { font-size: 0.9rem; display: block; margin-bottom: 0.5rem; }
        input, select, button {
            width: 100%;
            padding: 0.75rem 1rem;
            margin-bottom: 1rem;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 0.95rem;
        }
        button {
            background: var(--accent);
            color: #0f172a;
            font-weight: bold;
            border: none;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .result-box {
            background: var(--bg);
            border-radius: 8px;
            padding: 1rem;
            margin-top: 1rem;
            word-break: break-all;
            font-family: monospace;
            font-size: 0.9rem;
            min-height: 60px;
            border: 1px solid var(--border);
            white-space: pre-wrap;
        }
        .loading { color: var(--accent); }
        .error { color: #f87171; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 ECH DNS 查询</h1>
        <p class="subtitle">自动注入 ECH，部分域名返回优选 IP</p>
        <div>
            <label for="domain">域名</label>
            <input type="text" id="domain" placeholder="例如 twitter.com" value="twitter.com">
        </div>
        <div>
            <label for="type">记录类型</label>
            <select id="type">
                <option value="A">A (IPv4)</option>
                <option value="AAAA">AAAA (IPv6)</option>
                <option value="HTTPS">HTTPS (ECH)</option>
            </select>
        </div>
        <button id="queryBtn" onclick="doQuery()">查询</button>
        <div id="result" class="result-box"></div>
    </div>

    <script>
        async function doQuery() {
            const domain = document.getElementById('domain').value.trim();
            const type = document.getElementById('type').value;
            const btn = document.getElementById('queryBtn');
            const resultDiv = document.getElementById('result');

            if (!domain) {
                resultDiv.innerHTML = '<span class="error">请输入域名</span>';
                return;
            }

            btn.disabled = true;
            resultDiv.innerHTML = '<span class="loading">查询中…</span>';

            try {
                const res = await fetch('/api/query?domain=' + encodeURIComponent(domain) + '&type=' + type);
                const data = await res.json();
                if (data.error) {
                    resultDiv.innerHTML = '<span class="error">错误：' + data.error + '</span>';
                } else {
                    resultDiv.textContent = JSON.stringify(data, null, 2);
                }
            } catch (err) {
                resultDiv.innerHTML = '<span class="error">网络错误：' + err.message + '</span>';
            } finally {
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>`;
}