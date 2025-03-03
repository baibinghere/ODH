// Dictionary worker for ODH extension

// Message types
const MessageTypes = {
    LOAD_SCRIPT: 'LOAD_SCRIPT',
    EXECUTE_SCRIPT: 'EXECUTE_SCRIPT'
};

class DictionaryWorker {
    constructor() {
        this.scripts = new Map();
        this.setupMessageListener();
    }

    setupMessageListener() {
        self.onmessage = (event) => {
            const { type, payload, requestId } = event.data;
            this.handleMessage(type, payload, requestId);
        };
    }

    async handleMessage(type, payload, requestId) {
        try {
            let result = null;
            
            switch (type) {
                case MessageTypes.LOAD_SCRIPT:
                    result = await this.loadScript(payload.name, payload.code);
                    break;
                case MessageTypes.EXECUTE_SCRIPT:
                    result = await this.executeScript(payload.name, payload.params);
                    break;
                default:
                    throw new Error(`Unknown message type: ${type}`);
            }
            
            this.sendResponse(requestId, result);
        } catch (error) {
            console.error('Error handling message:', error);
            this.sendError(requestId, error.message);
        }
    }

    sendResponse(requestId, payload) {
        self.postMessage({
            requestId,
            payload,
            success: true
        });
    }

    sendError(requestId, error) {
        self.postMessage({
            requestId,
            error,
            success: false
        });
    }

    async loadScript(name, code) {
        try {
            // Create a function from the code
            const scriptFunction = new Function('exports', code);
            
            // Create an exports object for the script
            const exports = {};
            
            // Execute the script
            scriptFunction(exports);
            
            // Store the exports
            this.scripts.set(name, exports);
            
            return true;
        } catch (error) {
            console.error(`Error loading script ${name}:`, error);
            throw error;
        }
    }

    async executeScript(name, params) {
        const script = this.scripts.get(name);
        if (!script) {
            throw new Error(`Script ${name} not found`);
        }
        
        try {
            // Find the default export or the script itself
            const scriptFunction = script.default || script;
            
            if (typeof scriptFunction !== 'function') {
                throw new Error(`Script ${name} does not export a function`);
            }
            
            // Execute the script
            return await scriptFunction(params);
        } catch (error) {
            console.error(`Error executing script ${name}:`, error);
            throw error;
        }
    }
}

// Initialize the worker
const worker = new DictionaryWorker(); 