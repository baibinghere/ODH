export class Builtin {
    constructor() {
        this.dicts = {};
    }

    async loadData() {
        this.dicts['collins'] = await Builtin.loadData('data/collins.json');
    }

    findTerm(dictname, term) {
        const dict = this.dicts[dictname];
        return dict.hasOwnProperty(term) ? JSON.stringify(dict[term]):null;
    }

    static async loadData(path) {
        return new Promise(async (resolve, reject) => {
            try {
                let response = await fetch(path, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                let data = await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    }
    
}