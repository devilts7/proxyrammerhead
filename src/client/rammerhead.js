(function () {
    var hammerhead = window['%hammerhead%'];
    if (!hammerhead) throw new Error('hammerhead not loaded yet');
    if (hammerhead.settings._settings.sessionId) {
        // task.js already loaded. this will likely never happen though since this file loads before task.js
        console.warn('unexpected task.js to load before rammerhead.js. url shuffling cannot be used');
        main();
    } else {
        // wait for task.js to load
        hookHammerheadStartOnce(main);
        // before task.js, we need to add url shuffling
        addUrlShuffling();
    }

    function applyStealthPatches() {
        try {
            // Remove Chrome DevTools functions
            const cdcProps = Object.getOwnPropertyNames(window).filter(prop => prop.startsWith('cdc_'));
            cdcProps.forEach(prop => delete window[prop]);

            // Hide webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: false
            });

            // Mock permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Fake WebGL vendor/renderer
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel(R) Iris(TM) Graphics 6100';
                return getParameter.call(this, parameter);
            };

            // Add canvas noise to prevent fingerprinting
            const toDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(...args) {
                const result = toDataURL.apply(this, args);
                if (result.length > 10000) { // Only add noise to large canvases
                    const ctx = this.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = 'rgba(0,0,0,0.01)';
                        ctx.fillRect(Math.random() * this.width, Math.random() * this.height, 1, 1);
                        return toDataURL.apply(this, args);
                    }
                }
                return result;
            };

            // Hide automation indicators
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
                ]
            });

            // Fake languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Hide automation from chrome object
            if (window.chrome) {
                Object.defineProperty(window.chrome, 'runtime', {
                    get: () => undefined
                });
            }

            // Mock battery API
            if (!navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: Infinity,
                    dischargingTime: Infinity,
                    level: 1
                });
            }

            // Fake hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 4
            });

            // Fake device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });

            // Fake screen properties
            Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
            Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(screen, 'height', { get: () => 1080 });
            Object.defineProperty(screen, 'width', { get: () => 1920 });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

            // Fake window properties
            Object.defineProperty(window, 'innerHeight', { get: () => 1040 });
            Object.defineProperty(window, 'innerWidth', { get: () => 1920 });
            Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
            Object.defineProperty(window, 'outerWidth', { get: () => 1920 });

            // Disable WebRTC to prevent IP leakage
            Object.defineProperty(navigator, 'mediaDevices', {
                get: () => ({
                    enumerateDevices: () => Promise.resolve([]),
                    getUserMedia: () => Promise.reject(new Error('Not allowed'))
                })
            });

            // Spoof WebRTC
            if (window.RTCPeerConnection) {
                const originalRTCPeerConnection = window.RTCPeerConnection;
                window.RTCPeerConnection = function(...args) {
                    const pc = new originalRTCPeerConnection(...args);
                    pc.createDataChannel = () => ({});
                    pc.createOffer = () => Promise.resolve({ type: 'offer', sdp: 'fake' });
                    pc.createAnswer = () => Promise.resolve({ type: 'answer', sdp: 'fake' });
                    pc.setLocalDescription = () => Promise.resolve();
                    pc.setRemoteDescription = () => Promise.resolve();
                    return pc;
                };
            }

            // Hide WebGL extensions that might reveal automation
            const getSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
            WebGLRenderingContext.prototype.getSupportedExtensions = function() {
                const extensions = getSupportedExtensions.call(this) || [];
                return extensions.filter(ext =>
                    !ext.includes('debug') &&
                    !ext.includes('trace') &&
                    !ext.includes('disjoint')
                );
            };

            // Fake audio context fingerprint
            if (window.AudioContext || window.webkitAudioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const originalGetChannelData = AudioContext.prototype.getChannelData;
                AudioContext.prototype.getChannelData = function() {
                    const data = originalGetChannelData.call(this);
                    // Add slight noise to prevent exact fingerprinting
                    for (let i = 0; i < data.length; i++) {
                        data[i] += (Math.random() - 0.5) * 0.0001;
                    }
                    return data;
                };
            }

            // Advanced canvas fingerprinting evasion
            const getImageData = CanvasRenderingContext2D.prototype.getImageData;
            CanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height) {
                const imageData = getImageData.call(this, x, y, width, height);
                // Add subtle noise to prevent exact fingerprinting
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    data[i] += Math.floor(Math.random() * 3) - 1; // R
                    data[i + 1] += Math.floor(Math.random() * 3) - 1; // G
                    data[i + 2] += Math.floor(Math.random() * 3) - 1; // B
                    // Alpha stays the same
                }
                return imageData;
            };

            // Fake timezone
            Object.defineProperty(Intl, 'DateTimeFormat', {
                value: class extends Intl.DateTimeFormat {
                    resolvedOptions() {
                        const options = super.resolvedOptions();
                        options.timeZone = 'America/New_York';
                        return options;
                    }
                }
            });

            // Add random timing jitter to prevent timing attacks
            const originalDateNow = Date.now;
            const originalPerformanceNow = performance.now;
            Date.now = function() {
                return originalDateNow() + Math.floor(Math.random() * 10);
            };
            performance.now = function() {
                return originalPerformanceNow() + Math.random() * 0.1;
            };

            // Fake navigator properties
            Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
            Object.defineProperty(navigator, 'cookieEnabled', { get: () => true });
            Object.defineProperty(navigator, 'onLine', { get: () => true });

            // Fake connection properties
            if (!navigator.connection) {
                navigator.connection = {
                    effectiveType: '4g',
                    rtt: 50,
                    downlink: 10
                };
            }

            // Add mouse event simulation for more human-like behavior
            let lastMouseMove = 0;
            document.addEventListener('mousemove', (e) => {
                lastMouseMove = Date.now();
            }, { passive: true });

            // Fake mouse position occasionally
            setInterval(() => {
                if (Date.now() - lastMouseMove > 5000) {
                    // Simulate occasional mouse movement
                    const event = new MouseEvent('mousemove', {
                        clientX: Math.random() * window.innerWidth,
                        clientY: Math.random() * window.innerHeight,
                        bubbles: true
                    });
                    document.dispatchEvent(event);
                }
            }, 10000);

            // Hide automation from window properties
            Object.defineProperty(window, 'callPhantom', { get: () => undefined });
            Object.defineProperty(window, '_phantom', { get: () => undefined });
            Object.defineProperty(window, '__nightmare', { get: () => undefined });
            Object.defineProperty(window, 'nightmare', { get: () => undefined });

            // Fake doNotTrack
            Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });

            // Mock geolocation
            if (!navigator.geolocation) {
                navigator.geolocation = {
                    getCurrentPosition: (success, error) => {
                        if (success) success({ coords: { latitude: 37.7749, longitude: -122.4194 } });
                    },
                    watchPosition: () => 0,
                    clearWatch: () => {}
                };
            }

            // Hide automation from chrome object
            if (window.chrome) {
                Object.defineProperty(window.chrome, 'runtime', {
                    get: () => undefined
                });
            }

            // Mock battery API
            if (!navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: Infinity,
                    dischargingTime: Infinity,
                    level: 1
                });
            }

            // Fake hardware concurrency
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 4
            });

            // Fake device memory
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });

        } catch (e) {
            console.warn('Stealth patch failed:', e);
        }
    }

    function main() {
        // Stealth patches to hide proxy detection
        applyStealthPatches();

        fixUrlRewrite();
        fixElementGetter();
        fixCrossWindowLocalStorage();

        delete window.overrideGetProxyUrl;
        delete window.overrideParseProxyUrl;
        delete window.overrideIsCrossDomainWindows;

        // other code if they want to also hook onto hammerhead start //
        if (window.rammerheadStartListeners) {
            for (const eachListener of window.rammerheadStartListeners) {
                try {
                    eachListener();
                } catch (e) {
                    console.error(e);
                }
            }
            delete window.rammerheadStartListeners;
        }

        // sync localStorage code //
        // disable if other code wants to implement their own localStorage site wrapper
        if (window.rammerheadDisableLocalStorageImplementation) {
            delete window.rammerheadDisableLocalStorageImplementation;
            return;
        }
        // consts
        var timestampKey = 'rammerhead_synctimestamp';
        var updateInterval = 5000;
        var isSyncing = false;

        var proxiedLocalStorage = localStorage;
        var realLocalStorage = proxiedLocalStorage.internal.nativeStorage;
        var sessionId = hammerhead.settings._settings.sessionId;
        var origin = window.__get$(window, 'location').origin;
        var keyChanges = [];

        try {
            syncLocalStorage();
        } catch (e) {
            if (e.message !== 'server wants to disable localStorage syncing') {
                throw e;
            }
            return;
        }
        proxiedLocalStorage.addChangeEventListener(function (event) {
            if (isSyncing) return;
            if (keyChanges.indexOf(event.key) === -1) keyChanges.push(event.key);
        });
        setInterval(function () {
            var update = compileUpdate();
            if (!update) return;
            localStorageRequest({ type: 'update', updateData: update }, function (data) {
                updateTimestamp(data.timestamp);
            });

            keyChanges = [];
        }, updateInterval);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') {
                var update = compileUpdate();
                if (update) {
                    // even though we'll never get the timestamp, it's fine. this way,
                    // the data is safer
                    hammerhead.nativeMethods.sendBeacon.call(
                        window.navigator,
                        getSyncStorageEndpoint(),
                        JSON.stringify({
                            type: 'update',
                            updateData: update
                        })
                    );
                }
            }
        });

        function syncLocalStorage() {
            isSyncing = true;
            var timestamp = getTimestamp();
            var response;
            if (!timestamp) {
                // first time syncing
                response = localStorageRequest({ type: 'sync', fetch: true });
                if (response.timestamp) {
                    updateTimestamp(response.timestamp);
                    overwriteLocalStorage(response.data);
                }
            } else {
                // resync
                response = localStorageRequest({ type: 'sync', timestamp: timestamp, data: proxiedLocalStorage });
                if (response.timestamp) {
                    updateTimestamp(response.timestamp);
                    overwriteLocalStorage(response.data);
                }
            }
            isSyncing = false;

            function overwriteLocalStorage(data) {
                if (!data || typeof data !== 'object') throw new TypeError('data must be an object');
                proxiedLocalStorage.clear();
                for (var prop in data) {
                    proxiedLocalStorage[prop] = data[prop];
                }
            }
        }
        function updateTimestamp(timestamp) {
            if (!timestamp) throw new TypeError('timestamp must be defined');
            if (isNaN(parseInt(timestamp))) throw new TypeError('timestamp must be a number. received' + timestamp);
            realLocalStorage[timestampKey] = timestamp;
        }
        function getTimestamp() {
            var rawTimestamp = realLocalStorage[timestampKey];
            var timestamp = parseInt(rawTimestamp);
            if (isNaN(timestamp)) {
                if (rawTimestamp) {
                    console.warn('invalid timestamp retrieved from storage: ' + rawTimestamp);
                }
                return null;
            }
            return timestamp;
        }
        function getSyncStorageEndpoint() {
            return (
                '/syncLocalStorage?sessionId=' + encodeURIComponent(sessionId) + '&origin=' + encodeURIComponent(origin)
            );
        }
        function localStorageRequest(data, callback) {
            if (!data || typeof data !== 'object') throw new TypeError('data must be an object');

            var request = hammerhead.createNativeXHR();
            // make synchronous if there is no callback
            request.open('POST', getSyncStorageEndpoint(), !!callback);
            request.setRequestHeader('content-type', 'application/json');
            request.send(JSON.stringify(data));
            function check() {
                if (request.status === 404) {
                    throw new Error('server wants to disable localStorage syncing');
                }
                if (request.status !== 200)
                    throw new Error(
                        'server sent a non 200 code. got ' + request.status + '. Response: ' + request.responseText
                    );
            }
            if (!callback) {
                check();
                return JSON.parse(request.responseText);
            } else {
                request.onload = function () {
                    check();
                    callback(JSON.parse(request.responseText));
                };
            }
        }
        function compileUpdate() {
            if (!keyChanges.length) return null;

            var updates = {};
            for (var i = 0; i < keyChanges.length; i++) {
                updates[keyChanges[i]] = proxiedLocalStorage[keyChanges[i]];
            }

            keyChanges = [];
            return updates;
        }
    }

    var noShuffling = false;
    function addUrlShuffling() {
        const request = new XMLHttpRequest();
        const sessionId = (location.pathname.slice(1).match(/^[a-z0-9]+/i) || [])[0];
        if (!sessionId) {
            console.warn('cannot get session id from url');
            return;
        }
        request.open('GET', '/api/shuffleDict?id=' + sessionId, false);
        request.send();
        if (request.status !== 200) {
            console.warn(
                `received a non 200 status code while trying to fetch shuffleDict:\nstatus: ${request.status}\nresponse: ${request.responseText}`
            );
            return;
        }
        const shuffleDict = JSON.parse(request.responseText);
        if (!shuffleDict) return;

        // pasting entire thing here "because lazy" - m28
        const mod = (n, m) => ((n % m) + m) % m;
        const baseDictionary = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~-';
        const shuffledIndicator = '_rhs';
        const generateDictionary = function () {
            let str = '';
            const split = baseDictionary.split('');
            while (split.length > 0) {
                str += split.splice(Math.floor(Math.random() * split.length), 1)[0];
            }
            return str;
        };
        class StrShuffler {
            constructor(dictionary = generateDictionary()) {
                this.dictionary = dictionary;
            }
            shuffle(str) {
                if (str.startsWith(shuffledIndicator)) {
                    return str;
                }
                let shuffledStr = '';
                for (let i = 0; i < str.length; i++) {
                    const char = str.charAt(i);
                    const idx = baseDictionary.indexOf(char);
                    if (char === '%' && str.length - i >= 3) {
                        shuffledStr += char;
                        shuffledStr += str.charAt(++i);
                        shuffledStr += str.charAt(++i);
                    } else if (idx === -1) {
                        shuffledStr += char;
                    } else {
                        shuffledStr += this.dictionary.charAt(mod(idx + i, baseDictionary.length));
                    }
                }
                return shuffledIndicator + shuffledStr;
            }
            unshuffle(str) {
                if (!str.startsWith(shuffledIndicator)) {
                    return str;
                }

                str = str.slice(shuffledIndicator.length);

                let unshuffledStr = '';
                for (let i = 0; i < str.length; i++) {
                    const char = str.charAt(i);
                    const idx = this.dictionary.indexOf(char);
                    if (char === '%' && str.length - i >= 3) {
                        unshuffledStr += char;
                        unshuffledStr += str.charAt(++i);
                        unshuffledStr += str.charAt(++i);
                    } else if (idx === -1) {
                        unshuffledStr += char;
                    } else {
                        unshuffledStr += baseDictionary.charAt(mod(idx - i, baseDictionary.length));
                    }
                }
                return unshuffledStr;
            }
        }

        const replaceUrl = (url, replacer) => {
            //        regex:              https://google.com/    sessionid/   url
            return (url || '').replace(/^((?:[a-z0-9]+:\/\/[^/]+)?(?:\/[^/]+\/))([^]+)/i, function (_, g1, g2) {
                return g1 + replacer(g2);
            });
        };
        const shuffler = new StrShuffler(shuffleDict);

        // shuffle current url if it isn't already shuffled (unshuffled urls likely come from user input)
        const oldUrl = location.href;
        const newUrl = replaceUrl(location.href, (url) => shuffler.shuffle(url));
        if (oldUrl !== newUrl) {
            history.replaceState(null, null, newUrl);
        }

        const getProxyUrl = hammerhead.utils.url.getProxyUrl;
        const parseProxyUrl = hammerhead.utils.url.parseProxyUrl;
        hammerhead.utils.url.overrideGetProxyUrl(function (url, opts) {
            if (noShuffling) {
                return getProxyUrl(url, opts);
            }
            return replaceUrl(getProxyUrl(url, opts), (u) => shuffler.shuffle(u), true);
        });
        hammerhead.utils.url.overrideParseProxyUrl(function (url) {
            return parseProxyUrl(replaceUrl(url, (u) => shuffler.unshuffle(u), false));
        });
        // manual hooks //
        window.overrideGetProxyUrl(
            (getProxyUrl$1) =>
                function (url, opts) {
                    if (noShuffling) {
                        return getProxyUrl$1(url, opts);
                    }
                    return replaceUrl(getProxyUrl$1(url, opts), (u) => shuffler.shuffle(u), true);
                }
        );
        window.overrideParseProxyUrl(
            (parseProxyUrl$1) =>
                function (url) {
                    return parseProxyUrl$1(replaceUrl(url, (u) => shuffler.unshuffle(u), false));
                }
        );
    }
    function fixUrlRewrite() {
        const port = location.port || (location.protocol === 'https:' ? '443' : '80');
        const getProxyUrl = hammerhead.utils.url.getProxyUrl;
        hammerhead.utils.url.overrideGetProxyUrl(function (url, opts = {}) {
            if (!opts.proxyPort) {
                opts.proxyPort = port;
            }
            return getProxyUrl(url, opts);
        });
        window.overrideParseProxyUrl(
            (parseProxyUrl$1) =>
                function (url) {
                    const parsed = parseProxyUrl$1(url);
                    if (!parsed || !parsed.proxy) return parsed;
                    if (!parsed.proxy.port) {
                        parsed.proxy.port = port;
                    }
                    return parsed;
                }
        );
    }
    function fixElementGetter() {
        const fixList = {
            HTMLAnchorElement: ['href'],
            HTMLAreaElement: ['href'],
            HTMLBaseElement: ['href'],
            HTMLEmbedElement: ['src'],
            HTMLFormElement: ['action'],
            HTMLFrameElement: ['src'],
            HTMLIFrameElement: ['src'],
            HTMLImageElement: ['src'],
            HTMLInputElement: ['src'],
            HTMLLinkElement: ['href'],
            HTMLMediaElement: ['src'],
            HTMLModElement: ['cite'],
            HTMLObjectElement: ['data'],
            HTMLQuoteElement: ['cite'],
            HTMLScriptElement: ['src'],
            HTMLSourceElement: ['src'],
            HTMLTrackElement: ['src']
        };
        const urlRewrite = (url) => (hammerhead.utils.url.parseProxyUrl(url) || {}).destUrl || url;
        for (const ElementClass in fixList) {
            for (const attr of fixList[ElementClass]) {
                if (!window[ElementClass]) {
                    console.warn('unexpected unsupported element class ' + ElementClass);
                    continue;
                }
                const desc = Object.getOwnPropertyDescriptor(window[ElementClass].prototype, attr);
                const originalGet = desc.get;
                desc.get = function () {
                    return urlRewrite(originalGet.call(this));
                };
                if (attr === 'action') {
                    const originalSet = desc.set;
                    // don't shuffle form action urls
                    desc.set = function (value) {
                        noShuffling = true;
                        try {
                            var returnVal = originalSet.call(this, value);
                        } catch (e) {
                            noShuffling = false;
                            throw e;
                        }
                        noShuffling = false;
                        return returnVal;
                    };
                }
                Object.defineProperty(window[ElementClass].prototype, attr, desc);
            }
        }
    }
    function fixCrossWindowLocalStorage() {
        // completely replace hammerhead's implementation as restore() and save() on every
        // call is just not viable (mainly memory issues as the garbage collector is sometimes not fast enough)

        const getLocHost = win => (new URL(hammerhead.utils.url.parseProxyUrl(win.location.href).destUrl)).host;
        const prefix = win => `rammerhead|storage-wrapper|${hammerhead.settings._settings.sessionId}|${
            getLocHost(win)
        }|`;
        const toRealStorageKey = (key = '', win = window) => prefix(win) + key;
        const fromRealStorageKey = (key = '', win = window) => {
            if (!key.startsWith(prefix(win))) return null;
            return key.slice(prefix.length);
        };

        const replaceStorageInstance = (storageProp, realStorage) => {
            const reservedProps = ['internal', 'clear', 'key', 'getItem', 'setItem', 'removeItem', 'length'];
            Object.defineProperty(window, storageProp, {
                // define a value-based instead of getter-based property, since with this localStorage implementation,
                // we don't need to rely on sharing a single memory-based storage across frames, unlike hammerhead
                configurable: true,
                writable: true,
                // still use window[storageProp] as basis to allow scripts to access localStorage.internal
                value: new Proxy(window[storageProp], {
                    get(target, prop, receiver) {
                        if (reservedProps.includes(prop) && prop !== 'length') {
                            return Reflect.get(target, prop, receiver);
                        } else if (prop === 'length') {
                            let len = 0;
                            for (const [key] of Object.entries(realStorage)) {
                                if (fromRealStorageKey(key)) len++;
                            }
                            return len;
                        } else {
                            return realStorage[toRealStorageKey(prop)];
                        }
                    },
                    set(_, prop, value) {
                        if (!reservedProps.includes(prop)) {
                            realStorage[toRealStorageKey(prop)] = value;
                        }
                        return true;
                    },
                    deleteProperty(_, prop) {
                        delete realStorage[toRealStorageKey(prop)];
                        return true;
                    },
                    has(target, prop) {
                        return toRealStorageKey(prop) in realStorage || prop in target;
                    },
                    ownKeys() {
                        const list = [];
                        for (const [key] of Object.entries(realStorage)) {
                            const proxyKey = fromRealStorageKey(key);
                            if (proxyKey && !reservedProps.includes(proxyKey)) list.push(proxyKey);
                        }
                        return list;
                    },
                    getOwnPropertyDescriptor(_, prop) {
                        return Object.getOwnPropertyDescriptor(realStorage, toRealStorageKey(prop));
                    },
                    defineProperty(_, prop, desc) {
                        if (!reservedProps.includes(prop)) {
                            Object.defineProperty(realStorage, toRealStorageKey(prop), desc);
                        }
                        return true;
                    }
                })
            });
        };
        const rewriteFunction = (prop, newFunc) => {
            Storage.prototype[prop] = new Proxy(Storage.prototype[prop], {
                apply(_, thisArg, args) {
                    return newFunc.apply(thisArg, args);
                }
            });
        };

        replaceStorageInstance('localStorage', hammerhead.storages.localStorageProxy.internal.nativeStorage);
        replaceStorageInstance('sessionStorage', hammerhead.storages.sessionStorageProxy.internal.nativeStorage);
        rewriteFunction('clear', function () {
            for (const [key] of Object.entries(this)) {
                delete this[key];
            }
        });
        rewriteFunction('key', function (keyNum) {
            return (Object.entries(this)[keyNum] || [])[0] || null;
        });
        rewriteFunction('getItem', function (key) {
            return this.internal.nativeStorage[toRealStorageKey(key, this.internal.ctx)] || null;
        });
        rewriteFunction('setItem', function (key, value) {
            if (key) {
                this.internal.nativeStorage[toRealStorageKey(key, this.internal.ctx)] = value;
            }
        });
        rewriteFunction('removeItem', function (key) {
            delete this.internal.nativeStorage[toRealStorageKey(key, this.internal.ctx)];
        });
    }

    function hookHammerheadStartOnce(callback) {
        var originalStart = hammerhead.__proto__.start;
        hammerhead.__proto__.start = function () {
            originalStart.apply(this, arguments);
            hammerhead.__proto__.start = originalStart;
            callback();
        };
    }
})();
