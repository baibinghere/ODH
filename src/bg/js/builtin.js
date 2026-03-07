class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        try {
            this.dicts['collins'] = await Builtin.loadData('data/collins.json');
        } catch (e) {
            this.dicts['collins'] = {};
        }
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
        return (dict && dict.hasOwnProperty(term)) ? JSON.stringify(dict[term]) : null;
    }

    static async loadData(path) {
        const response = await fetch(chrome.runtime.getURL(path));
        if (!response.ok) throw new Error('Failed to load ' + path);
        return await response.json();
    }
}
