// Dictionary manager for ODH extension (Service Worker compatible)

class WorkerManager {
    constructor() {
        this.scripts = new Map();
        this.messageHandlers = new Map();
    }

    // 直接在 Service Worker 中加载脚本，不使用 Worker
    async loadScript(name, code) {
        try {
            console.log(`Loading script: ${name}`);
            
            // 创建一个函数来执行脚本代码
            const scriptFunction = new Function('exports', code);
            
            // 创建一个导出对象
            const exports = {};
            
            // 执行脚本
            scriptFunction(exports);
            
            // 存储导出对象
            this.scripts.set(name, exports);
            
            console.log(`Script ${name} loaded successfully`);
            return true;
        } catch (error) {
            console.error(`Error loading script ${name}:`, error);
            return false;
        }
    }

    // 直接在 Service Worker 中执行脚本
    async executeScript(name, params) {
        try {
            const script = this.scripts.get(name);
            if (!script) {
                throw new Error(`Script ${name} not found`);
            }
            
            // 查找默认导出或脚本本身
            const scriptFunction = script.default || script;
            
            if (typeof scriptFunction !== 'function') {
                throw new Error(`Script ${name} does not export a function`);
            }
            
            // 执行脚本
            const result = await scriptFunction(params);
            return result;
        } catch (error) {
            console.error(`Error executing script ${name}:`, error);
            throw error;
        }
    }

    // 清理资源
    terminate() {
        this.scripts.clear();
        this.messageHandlers.clear();
    }
}

// 为 Service Worker 环境导出类
if (typeof self !== 'undefined') {
    self.WorkerManager = WorkerManager;
} 