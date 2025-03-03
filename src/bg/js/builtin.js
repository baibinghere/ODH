class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        try {
            this.dicts['collins'] = await Builtin.loadData('data/collins.json');
            console.log('Builtin dictionary data loaded successfully');
        } catch (error) {
            console.error('Failed to load builtin dictionary data:', error);
        }
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
        if (!dict) {
            console.warn(`Dictionary ${dictname} not found`);
            return null;
        }
        return dict.hasOwnProperty(term) ? JSON.stringify(dict[term]) : null;
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
    self.Builtin = Builtin;
}