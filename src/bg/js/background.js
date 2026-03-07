async function ensureOffscreen() {
    try {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });
        if (contexts.length > 0) return;
    } catch (e) {
        // chrome.runtime.getContexts may not be available in older Chrome
    }

    try {
        await chrome.offscreen.createDocument({
            url: 'bg/offscreen.html',
            reasons: ['DOM_SCRAPING', 'AUDIO_PLAYBACK'],
            justification: 'Sandbox for dictionary scripts and audio playback'
        });
    } catch (e) {
        // Document may already exist
    }
}

ensureOffscreen();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.target === 'offscreen') return false;

    if (request.target === 'background') {
        return handleBackgroundAction(request.action, request.params, sendResponse);
    }

    ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
            { target: 'offscreen', action: request.action, params: request.params },
            (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse(null);
                } else {
                    sendResponse(response);
                }
            }
        );
    });
    return true;
});

function handleBackgroundAction(action, params, sendResponse) {
    switch (action) {
        case 'setBadgeText':
            chrome.action.setBadgeText({ text: params.text });
            return false;
        case 'tabInvoke':
            chrome.tabs.sendMessage(params.tabId, {
                action: params.action,
                params: params.params
            }).catch(() => {});
            return false;
        case 'tabInvokeAll':
            chrome.tabs.query({}, (tabs) => {
                for (let tab of tabs) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: params.action,
                        params: params.params
                    }).catch(() => {});
                }
            });
            return false;
        case 'storageGet':
            chrome.storage.local.get(null, (options) => {
                sendResponse(options || {});
            });
            return true;
        case 'storageSet':
            chrome.storage.local.set(params.data, () => {
                sendResponse(true);
            });
            return true;
        default:
            return false;
    }
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('bg/guide.html') });
    } else if (details.reason === 'update') {
        chrome.tabs.create({ url: chrome.runtime.getURL('bg/update.html') });
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command !== 'enabled') return;
    ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
            { target: 'offscreen', action: 'toggleEnabled', params: {} },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
    });
});

chrome.tabs.onCreated.addListener((tab) => {
    ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
            { target: 'offscreen', action: 'tabReady', params: { tabId: tab.id } },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
    });
});

chrome.tabs.onUpdated.addListener((tabId) => {
    ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
            { target: 'offscreen', action: 'tabReady', params: { tabId } },
            () => { if (chrome.runtime.lastError) { /* ignore */ } }
        );
    });
});
