const config = require('../config');
const getSessionId = require('../util/getSessionId');

// Request throttling to simulate human browsing patterns
const requestTimes = new Map();
const MIN_REQUEST_INTERVAL = 50; // Minimum 50ms between requests

/**
 * @param {import('../classes/RammerheadProxy')} proxyServer
 * @param {import('../classes/RammerheadSessionAbstractStore')} sessionStore
 */
module.exports = function setupPipeline(proxyServer, sessionStore) {
    // Enhanced anti-detection for Smoothwall Cloud and other filters
    proxyServer.addToOnRequestPipeline((req, res, _serverInfo, isRoute) => {
        if (isRoute) return;

        // Restrict session to IP if enabled
        if (config.restrictSessionToIP) {
            const sessionId = getSessionId(req.url);
            const session = sessionId && sessionStore.get(sessionId);
            if (session && session.data.restrictIP && session.data.restrictIP !== config.getIP(req)) {
                res.writeHead(403);
                res.end('Sessions must come from the same IP');
                return true;
            }
        }

        // Request throttling to simulate human browsing
        const clientIP = config.getIP(req);
        const now = Date.now();
        const lastRequest = requestTimes.get(clientIP) || 0;

        if (now - lastRequest < MIN_REQUEST_INTERVAL) {
            const delay = MIN_REQUEST_INTERVAL - (now - lastRequest);
            setTimeout(() => {
                requestTimes.set(clientIP, Date.now());
            }, delay);
        } else {
            requestTimes.set(clientIP, now);
        }

        // Strip client headers that reveal proxy/VPN
        for (const eachHeader of config.stripClientHeaders) {
            delete req.headers[eachHeader];
        }

        // Block Smoothwall detection requests
        const smoothwallDetectionPaths = [
            'wpad',
            '/av-check',
            '/dmca',
            '/internet-check',
            '/smartcard',
            '/av.html',
            '/probe.js'
        ];
        
        if (smoothwallDetectionPaths.some(path => req.url.toLowerCase().includes(path))) {
            res.writeHead(204, {});
            res.end();
            return true;
        }

        // Add realistic but randomized headers
        if (!req.headers['accept-language']) {
            const languages = [
                'en-US,en;q=0.9',
                'en-GB,en;q=0.9',
                'en-AU,en;q=0.9',
                'en-CA,en;q=0.9'
            ];
            req.headers['accept-language'] = languages[Math.floor(Math.random() * languages.length)];
        }
        
        if (!req.headers['accept-encoding']) {
            req.headers['accept-encoding'] = 'gzip, deflate, br';
        }
        
        if (!req.headers['cache-control']) {
            req.headers['cache-control'] = 'max-age=0';
        }
        
        if (!req.headers['upgrade-insecure-requests']) {
            req.headers['upgrade-insecure-requests'] = '1';
        }
        
        // Randomize referer behavior to avoid pattern detection
        if (!req.headers['referer']) {
            // Occasionally add a referer to appear more natural
            if (Math.random() > 0.3) {
                const refererDomains = [
                    'https://www.google.com/',
                    'https://www.bing.com/',
                    'https://duckduckgo.com/'
                ];
                req.headers['referer'] = refererDomains[Math.floor(Math.random() * refererDomains.length)];
            }
        }
        
        // Randomize sec-fetch headers to vary request patterns
        if (Math.random() > 0.4) {
            req.headers['sec-fetch-mode'] = 'navigate';
            req.headers['sec-fetch-site'] = 'none';
            req.headers['sec-fetch-dest'] = 'document';
        }
        
        // Add HTTP/2 style headers but mix them to avoid pattern
        if (Math.random() > 0.3) {
            req.headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
        }

        // Randomize user agent with realistic variations
        if (req.headers['user-agent']) {
            const ua = req.headers['user-agent'];
            
            // Randomly rotate user agents between popular browsers
            if (Math.random() > 0.7) {
                const userAgents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
                ];
                req.headers['user-agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];
            } else if (ua.includes('Chrome')) {
                // Slight variation on Chrome version to avoid exact matching
                const versionMatch = ua.match(/Chrome\/(\d+)/);
                if (versionMatch) {
                    const version = parseInt(versionMatch[1]);
                    const newVersion = version + Math.floor(Math.random() * 5) - 2;
                    req.headers['user-agent'] = ua.replace(/Chrome\/\d+/, `Chrome/${Math.max(80, newVersion)}`);
                }
            }
        }

        // Hide common proxy/VPN identifying headers
        delete req.headers['x-tunnel'];
        delete req.headers['x-proxy-authorization'];
        delete req.headers['proxy-authorization'];
        delete req.headers['x-forwarded-proto'];
    });

    // Enhanced header rewriting with randomization
    const originalRewriteHeaders = proxyServer.rewriteServerHeaders || {};
    const mergedRewriteHeaders = {
        ...originalRewriteHeaders,
        // Apply config rewrites explicitly for Smoothwall detection
        ...Object.fromEntries(
            Object.entries(config.rewriteServerHeaders || {}).map(([header, value]) => {
                if (value === null) {
                    return [header, () => null];
                }
                if (typeof value === 'function') {
                    return [header, value];
                }
                return [header, () => value];
            })
        ),
        date: () => new Date().toUTCString(),
        'x-request-id': () => Math.random().toString(36).substr(2, 9),
        // Remove ALL known proxy/VPN/filter detection headers
        'x-cache': () => null,
        'x-cache-hits': () => null,
        'x-cache-status': () => null,
        'x-served-by': () => null,
        'x-timer': () => null,
        via: () => null,
        'x-forwarded-for': () => null,
        'x-real-ip': () => null,
        'x-forwarded-host': () => null,
        'x-forwarded-proto': () => null,
        'x-originating-ip': () => null,
        'x-scantime': () => null,
        'x-block-id': () => null,
        'x-filtered-by': () => null,
        'x-av-status': () => null
    };

    proxyServer.rewriteServerHeaders = mergedRewriteHeaders;
};
