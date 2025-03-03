function sanitizeOptions(options) {
    const defaults = {
        enabled: true,
        mouseselection: true,
        hotkey: '16', // 0:off , 16:shift, 17:ctrl, 18:alt
        maxcontext: '1',
        maxexample: '2',
        monolingual: '0', //0: bilingual 1:monolingual
        preferredaudio: '0',
        services: 'none',
        id: '',
        password: '',

        duplicate: '1', // 0: not allowe duplicated cards; 1: allowe duplicated cards;
        tags: 'ODH',
        deckname: 'Default',
        typename: 'Basic',
        expression: 'Front',
        reading: '',
        extrainfo: '',
        definition: 'Back',
        definitions: '',
        sentence: '',
        url: '',
        audio: '',

        sysscripts: 'builtin_encn_Collins,encn_Collins,encn_Cambridge,encn_Oxford,fren_Cambridge,esen_Spanishdict,decn_Eudict,escn_Eudict,frcn_Eudict',
        udfscripts: '',

        dictSelected: '',
        dictNamelist: [],
    };

    for (const key in defaults) {
        if (!options.hasOwnProperty(key)) {
            options[key] = defaults[key];
        }
    }
    return options;
}


async function optionsLoad() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (options) => {
            resolve(sanitizeOptions(options));
        });
    });
}

async function optionsSave(options) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(sanitizeOptions(options), resolve());
    });
}

function utilAsync(func) {
    return function(...args) {
        func.apply(this, args);
    };
}

// 在 Manifest V3 中，使用消息传递替代 getBackgroundPage
async function odhback() {
    // 创建一个代理对象，将所有方法调用转换为消息
    return new Proxy({}, {
        get: function(target, prop) {
            return async function(...args) {
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: prop,
                        params: args[0] || {}
                    }, response => {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    });
                });
            };
        }
    });
}

function localizeHtmlPage() {
    for (const el of document.querySelectorAll('[data-i18n]')) {
        el.innerHTML = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    }
}

// 为 Service Worker 环境导出函数
if (typeof self !== 'undefined') {
    self.sanitizeOptions = sanitizeOptions;
    self.utilAsync = utilAsync;
    self.localizeHtmlPage = localizeHtmlPage;
}