// ODH Service Worker - Entry point for Manifest V3 extension
import {ODHBack} from "./js/backend";

// 初始化后端
async function initializeBackend() {
    try {
        // 检查 odhback 实例是否已经创建
        if (typeof self.odhback !== 'object' || self.odhback === null) {
            console.log('Creating new ODHBack instance...');
            self.odhback = new ODHBack();
        }
        console.log('Calling api_initBackend...');
        try {
            const result = await self.odhback.api_initBackend({});
            console.log('ODH backend initialized successfully, result:', result);
        } catch (error) {
            console.error('Error calling api_initBackend:', error);
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