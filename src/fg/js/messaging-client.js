// Messaging client for content scripts

export class MessagingClient {
    constructor(portName) {
        this.port = chrome.runtime.connect({ name: portName });
        this.messageHandlers = new Map();
        this.setupMessageListener();
    }

    setupMessageListener() {
        this.port.onMessage.addListener((message) => {
            const { type, payload, error, success, requestId } = message;
            
            if (requestId && this.messageHandlers.has(requestId)) {
                const handler = this.messageHandlers.get(requestId);
                
                if (success) {
                    handler.resolve(payload);
                } else {
                    handler.reject(new Error(error));
                }
                this.messageHandlers.delete(requestId);
            }
        });

        this.port.onDisconnect.addListener(() => {
            const error = new Error('Connection to background script lost');
            for (const handler of this.messageHandlers.values()) {
                handler.reject(error);
            }
            this.messageHandlers.clear();
        });
    }

    sendMessage(type, payload) {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId();
            this.messageHandlers.set(requestId, { resolve, reject });
            this.port.postMessage({ type, payload, requestId });
        });
    }

    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async searchDictionary(expression) {
        return await this.sendMessage('DICTIONARY_SEARCH', { expression });
    }

    async addAnkiNote(notedef) {
        return await this.sendMessage('ANKI_ADD_NOTE', { notedef });
    }

    async playAudio(url) {
        return await this.sendMessage('PLAY_AUDIO', { url });
    }

    async getOptions() {
        return await this.sendMessage('GET_OPTIONS', {});
    }

    async setOptions(options) {
        return await this.sendMessage('SET_OPTIONS', options);
    }

    async loadScript(name) {
        return await this.sendMessage('LOAD_SCRIPT', { name });
    }

    async executeScript(name, params) {
        return await this.sendMessage('EXECUTE_SCRIPT', { name, params });
    }
} 