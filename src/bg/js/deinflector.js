class Deinflector {
    constructor() {
        this.path = 'data/wordforms.json';
        this.wordforms = null;
    }

    async loadData() {
        try {
            this.wordforms = await Deinflector.loadData(this.path);
        } catch (e) {
            this.wordforms = {};
        }
    }

    deinflect(term) {
        return this.wordforms[term] ? this.wordforms[term] : null;
    }

    static async loadData(path) {
        const response = await fetch(chrome.runtime.getURL(path));
        if (!response.ok) throw new Error('Failed to load ' + path);
        return await response.json();
    }
}
