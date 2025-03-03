class Deinflector {
    constructor() {
        this.path = 'data/wordforms.json';
        this.wordforms = null;
    }

    async loadData() {
        try {
            this.wordforms = await Deinflector.loadData(this.path);
            console.log('Word forms data loaded successfully');
        } catch (error) {
            console.error('Failed to load word forms data:', error);
            // Initialize with empty object to prevent null reference errors
            this.wordforms = {};
        }
    }

    deinflect(term) {
        if (!this.wordforms) {
            console.warn('Word forms data not loaded yet');
            return null;
        }
        return this.wordforms[term] ? this.wordforms[term] : null;
    }

    static async loadData(path) {
        try {
            const response = await fetch(chrome.runtime.getURL(path));
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error loading data from ${path}:`, error);
            throw error;
        }
    }
}

// 为 Service Worker 环境导出类
if (typeof self !== 'undefined') {
    self.Deinflector = Deinflector;
}
