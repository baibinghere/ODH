// ODH Service Worker - Entry point for Manifest V3 extension

// 使用 importScripts 加载依赖模块
self.importScripts(
    './js/ankiconnect.js',
    './js/ankiweb.js',
    './js/builtin.js',
    './js/deinflector.js',
    './js/agent.js',
    './js/options.js',
    './js/worker-manager.js',
    './js/utils.js'
);

// 最后加载 backend.js，确保其他依赖已经加载
self.importScripts('./js/backend.js');

// 初始化后端
async function initializeBackend() {
    try {
        console.log('Initializing ODH backend...');

        // 检查依赖模块是否正确加载
        console.log('Checking dependencies...');
        if (typeof self.Ankiconnect !== 'function') {
            console.error('Ankiconnect class is not available');
        } else {
            console.log('Ankiconnect class is available');
        }

        if (typeof self.Ankiweb !== 'function') {
            console.error('Ankiweb class is not available');
        } else {
            console.log('Ankiweb class is available');
        }

        if (typeof self.optionsLoad !== 'function') {
            console.error('optionsLoad function is not available');
        } else {
            console.log('optionsLoad function is available');
        }

        // 检查 ODHBack 是否可用
        if (typeof self.ODHBack !== 'function') {
            console.error('ODHBack class is not available');
            return;
        }

        // 检查 odhback 实例是否已经创建
        if (typeof self.odhback !== 'object' || self.odhback === null) {
            console.log('Creating new ODHBack instance...');
            self.odhback = new self.ODHBack();
        }

        // 检查 api_initBackend 方法是否可用
        if (typeof self.odhback.api_initBackend !== 'function') {
            console.error('api_initBackend method is not available');

            // 尝试手动初始化
            console.log('Attempting manual initialization...');

            // 加载选项
            const options = await optionsLoad();
            if (options) {
                console.log('Options loaded successfully:', options);

                // 初始化 Ankiweb 连接
                if (typeof self.odhback.ankiweb === 'object' &&
                    typeof self.odhback.ankiweb.initConnection === 'function') {
                    try {
                        console.log('Initializing Ankiweb connection...');
                        await self.odhback.ankiweb.initConnection(options);
                        console.log('Ankiweb connection initialized successfully');
                    } catch (error) {
                        console.error('Error initializing Ankiweb connection:', error);
                    }
                } else {
                    console.error('ankiweb object or initConnection method is not available');
                }

                // 更新选项
                if (typeof self.odhback.opt_optionsChanged === 'function') {
                    try {
                        console.log('Updating options...');
                        await self.odhback.opt_optionsChanged(options);
                        console.log('Options updated successfully');
                    } catch (error) {
                        console.error('Error updating options:', error);
                    }
                } else {
                    console.error('opt_optionsChanged method is not available');
                }
            } else {
                console.warn('No options found, using defaults');
            }
        } else {
            // 正常初始化
            console.log('Calling api_initBackend...');
            try {
                const result = await self.odhback.api_initBackend({});
                console.log('ODH backend initialized successfully, result:', result);
            } catch (error) {
                console.error('Error calling api_initBackend:', error);
            }
        }
    } catch (error) {
        console.error('Error initializing ODH backend:', error);
    }
}

// 当 Service Worker 启动时初始化后端
initializeBackend();

// 监听来自内容脚本和弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 记录消息以进行调试
    console.log('Service worker received message:', message);

    // 确保 odhback 对象存在
    if (!self.odhback) {
        console.error('odhback object not available');
        sendResponse({ error: 'Backend not initialized' });
        return true;
    }

    // 将消息转发到后端
    if (message && message.action) {
        const { action, params } = message;

        // 检查是否是 API 方法
        if (action.startsWith('api_') && typeof self.odhback[action] === 'function') {
            // 添加回调函数
            const callbackParams = { ...params, callback: sendResponse };
            self.odhback[action].call(self.odhback, callbackParams);
            return true; // 保持消息通道开放以进行异步响应
        }

        // 检查是否是选项方法
        if (action.startsWith('opt_') && typeof self.odhback[action] === 'function') {
            // 处理选项方法
            self.odhback[action].call(self.odhback, params)
                .then(result => sendResponse(result))
                .catch(error => {
                    console.error(`Error executing ${action}:`, error);
                    sendResponse(null);
                });
            return true; // 保持消息通道开放以进行异步响应
        }

        // 处理其他特殊方法
        if (action === 'ankiweb.initConnection' && self.odhback.ankiweb) {
            self.odhback.ankiweb.initConnection(params)
                .then(result => sendResponse(result))
                .catch(error => {
                    console.error('Error initializing Ankiweb connection:', error);
                    sendResponse(null);
                });
            return true;
        }
    }

    return true; // 保持消息通道开放以进行异步响应
});

// 记录 Service Worker 激活时的日志
console.log('ODH Service Worker activated');

// 保持 Service Worker 活跃
self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('ODH Service Worker installed');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('ODH Service Worker activated and claimed clients');
}); 