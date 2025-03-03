// Messaging system for ODH extension

export const MessageTypes = {
    CONNECT: 'CONNECT',
    DISCONNECT: 'DISCONNECT',
    GET_OPTIONS: 'GET_OPTIONS',
    SET_OPTIONS: 'SET_OPTIONS',
    DICTIONARY_SEARCH: 'DICTIONARY_SEARCH',
    ANKI_ADD_NOTE: 'ANKI_ADD_NOTE',
    PLAY_AUDIO: 'PLAY_AUDIO',
    LOAD_SCRIPT: 'LOAD_SCRIPT',
    EXECUTE_SCRIPT: 'EXECUTE_SCRIPT'
};

export class MessagingSystem {
    constructor() {
        this.ports = new Map();
        this.setupListeners();
    }

    setupListeners() {
        chrome.runtime.onConnect.addListener(port => {
            console.log('Port connected:', port.name);
            
            // Store the port
            this.ports.set(port.name, port);
            
            // Setup disconnect handler
            port.onDisconnect.addListener(() => {
                console.log('Port disconnected:', port.name);
                this.ports.delete(port.name);
            });
            
            // Setup message handler
            port.onMessage.addListener(message => {
                this.handleMessage(port, message);
            });
        });
    }

    async handleMessage(port, message) {
        const { type, payload, requestId } = message;
        console.log('Received message:', type, payload);
        
        try {
            // Handle different message types
            switch (type) {
                case MessageTypes.GET_OPTIONS:
                    // Implementation will be added later
                    break;
                case MessageTypes.SET_OPTIONS:
                    // Implementation will be added later
                    break;
                case MessageTypes.DICTIONARY_SEARCH:
                    // Implementation will be added later
                    break;
                case MessageTypes.ANKI_ADD_NOTE:
                    // Implementation will be added later
                    break;
                case MessageTypes.PLAY_AUDIO:
                    // Implementation will be added later
                    break;
                case MessageTypes.LOAD_SCRIPT:
                    // Implementation will be added later
                    break;
                case MessageTypes.EXECUTE_SCRIPT:
                    // Implementation will be added later
                    break;
                default:
                    console.warn('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.sendResponse(port, requestId, null, error.message);
        }
    }

    sendResponse(port, requestId, data, error = null) {
        port.postMessage({
            requestId,
            payload: data,
            error,
            success: !error
        });
    }

    broadcast(type, payload) {
        for (const port of this.ports.values()) {
            port.postMessage({ type, payload });
        }
    }
} 