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
    // remove headers defined in config.js
    proxyServer.addToOnRequestPipeline((req, res, _serverInfo, isRoute) => {
        if (isRoute) return; // only strip those that are going to the proxy destination website

        // restrict session to IP if enabled
        if (config.restrictSessionToIP) {
            const sessionId = getSessionId(req.url);
            const session = sessionId && sessionStore.get(sessionId);
            if (session && session.data.restrictIP && session.data.restrictIP !== config.getIP(req)) {
                res.writeHead(403);
                res.end('Sessions must come from the same IP');
                return true;
            }
        }

        // Request throttling
        const clientIP = config.getIP(req);
        const now = Date.now();
        const lastRequest = requestTimes.get(clientIP) || 0;

        if (now - lastRequest < MIN_REQUEST_INTERVAL) {
            // Add small delay to simulate human browsing
            const delay = MIN_REQUEST_INTERVAL - (now - lastRequest);
            setTimeout(() => {
                requestTimes.set(clientIP, Date.now());
            }, delay);
        } else {
            requestTimes.set(clientIP, now);
        }

        for (const eachHeader of config.stripClientHeaders) {
            delete req.headers[eachHeader];
        }

        // Add realistic headers to make requests look more natural
        if (!req.headers['accept-language']) {
            req.headers['accept-language'] = 'en-US,en;q=0.9';
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

        // Randomize user agent slightly to avoid patterns
        if (req.headers['user-agent']) {
            const ua = req.headers['user-agent'];
            if (ua.includes('Chrome')) {
                // Add slight variation to Chrome version
                const versionMatch = ua.match(/Chrome\/(\d+)/);
                if (versionMatch) {
                    const version = parseInt(versionMatch[1]);
                    const newVersion = version + Math.floor(Math.random() * 5) - 2;
                    req.headers['user-agent'] = ua.replace(/Chrome\/\d+/, `Chrome/${newVersion}`);
                }
            }
        }
    });

    // Enhanced header rewriting with randomization
    const originalRewriteHeaders = proxyServer.rewriteServerHeaders || {};
    const mergedRewriteHeaders = {
        ...originalRewriteHeaders,
        // Apply config rewrites explicitly so null values remove headers
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
        'x-cache': () => null,
        'x-cache-hits': () => null,
        'x-cache-status': () => null,
        'x-served-by': () => null,
        'x-timer': () => null,
        via: () => null,
        'x-forwarded-for': () => null,
        'x-real-ip': () => null
    };

    proxyServer.rewriteServerHeaders = mergedRewriteHeaders;
};
