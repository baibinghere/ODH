// ODH Service Worker - Entry point for Manifest V3 extension
console.log("Service Worker loading started");
import {ODHBack} from "./js/backend.js";

const odhback = new ODHBack();

// 监听来自内容脚本和弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Service worker received message:', message);
    switch (message.action) {
        case "getODHBack":
            return odhback;
    }
    // if (!odhback) {
    //     console.error('Backend not initialized, attempting to initialize...');
    //     initializeBackend().then(success => {
    //         if (!success) {
    //             sendResponse({ error: 'Failed to initialize backend' });
    //         } else {
    //             handleMessage(message, sender, sendResponse);
    //         }
    //     });
    //     return true;
    // }
    //
    // return handleMessage(message, sender, sendResponse);
});

// try {
//     // 使用动态导入来处理模块加载错误
//     const { ODHBack } = await import('./js/backend.js').catch(error => {
//         console.error('Failed to import backend module:', error);
//         throw error;
//     });
//
//     let odhback = null;
//
//     // 初始化后端
//     async function initializeBackend() {
//         try {
//             if (!odhback) {
//                 console.log('Creating new ODHBack instance...');
//                 odhback = new ODHBack();
//
//                 try {
//                     const result = await odhback.api_initBackend({});
//                     console.log('ODH backend initialized successfully:', result);
//                     return true;
//                 } catch (error) {
//                     console.error('Failed to initialize backend:', error);
//                     odhback = null;
//                     return false;
//                 }
//             }
//             return true;
//         } catch (error) {
//             console.error('Critical error in initializeBackend:', error);
//             return false;
//         }
//     }
//
//     // 当 Service Worker 启动时初始化后端
//     console.log("Service Worker loading started");
//     await initializeBackend().catch(error => {
//         console.error('Failed to initialize ODH backend:', error);
//     });
//
//     // 监听来自内容脚本和弹出窗口的消息
//     chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//         console.log('Service worker received message:', message);
//
//         if (!odhback) {
//             console.error('Backend not initialized, attempting to initialize...');
//             initializeBackend().then(success => {
//                 if (!success) {
//                     sendResponse({ error: 'Failed to initialize backend' });
//                 } else {
//                     handleMessage(message, sender, sendResponse);
//                 }
//             });
//             return true;
//         }
//
//         return handleMessage(message, sender, sendResponse);
//     });
//
//     function handleMessage(message, sender, sendResponse) {
//         if (!message || !message.action) {
//             sendResponse({ error: 'Invalid message format' });
//             return true;
//         }
//
//         const { action, params } = message;
//
//         try {
//             if (action.startsWith('api_') && typeof odhback[action] === 'function') {
//                 const callbackParams = { ...params, callback: sendResponse };
//                 odhback[action].call(odhback, callbackParams);
//                 return true;
//             }
//
//             if (action.startsWith('opt_') && typeof odhback[action] === 'function') {
//                 odhback[action].call(odhback, params)
//                     .then(result => sendResponse(result))
//                     .catch(error => {
//                         console.error(`Error executing ${action}:`, error);
//                         sendResponse({ error: error.message });
//                     });
//                 return true;
//             }
//
//             if (action === 'ankiweb.initConnection' && odhback.ankiweb) {
//                 odhback.ankiweb.initConnection(params)
//                     .then(result => sendResponse(result))
//                     .catch(error => {
//                         console.error('Error initializing Ankiweb connection:', error);
//                         sendResponse({ error: error.message });
//                     });
//                 return true;
//             }
//
//             sendResponse({ error: `Unknown action: ${action}` });
//         } catch (error) {
//             console.error('Error handling message:', error);
//             sendResponse({ error: error.message });
//         }
//         return true;
//     }
//
//     // Service Worker 生命周期事件
//     self.addEventListener('install', (event) => {
//         console.log('ODH Service Worker installing...');
//         event.waitUntil(
//             Promise.resolve()
//                 .then(() => self.skipWaiting())
//                 .then(() => console.log('ODH Service Worker installed'))
//                 .catch(error => console.error('Install error:', error))
//         );
//     });
//
//     self.addEventListener('activate', (event) => {
//         console.log('ODH Service Worker activating...');
//         event.waitUntil(
//             Promise.resolve()
//                 .then(() => clients.claim())
//                 .then(() => console.log('ODH Service Worker activated and claimed clients'))
//                 .catch(error => console.error('Activation error:', error))
//         );
//     });
//
// } catch (error) {
//     console.error('Critical error in Service Worker initialization:', error);
//     throw error;
// }
//
// // 添加错误处理
// self.addEventListener('error', (event) => {
//     console.error('Service Worker error:', event.error);
// });
//
// self.addEventListener('unhandledrejection', (event) => {
//     console.error('Unhandled promise rejection:', event.reason);
// });