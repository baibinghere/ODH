class Ankiweb {
    constructor() {
        this.profile = null;
        this.version = 'web';
        this.id = '';
        this.password = '';
    }

    async initConnection(options, forceLogout = false) {
        const retryCount = 1;
        this.id = options.id;
        this.password = options.password;
        this.profile = await this.getProfile(retryCount, forceLogout);
        return;
    }

    async addNote(note) {
        return (note && this.profile) ? await this.saveNote(note) : Promise.resolve(null);
    }

    async getDeckNames() {
        return this.profile ? this.profile.decknames : null;
    }

    async getModelNames() {
        return this.profile ? this.profile.modelnames : null;
    }

    async getModelFieldNames(modelName) {
        return this.profile ? this.profile.modelfieldnames[modelName] : null;
    }

    async getVersion() {
        return this.profile ? this.version : null;
    }

    async api_connect(forceLogout = false) {
        let url = forceLogout ? 'https://ankiweb.net/account/logout' : 'https://ankiuser.net/edit/';
        const response = await fetch(url);
        const result = await response.text();

        let parser = new DOMParser();
        let doc = parser.parseFromString(result, 'text/html');
        let title = doc.querySelectorAll('h1');
        if (!title.length) return Promise.reject(false);

        switch (title[0].textContent.trim()) {
            case 'Add':
                return {
                    action: 'edit',
                    data: await this.parseData(result)
                };
            case 'Log in':
                return {
                    action: 'login',
                    data: doc.querySelector('input[name=csrf_token]').getAttribute('value')
                };
            default:
                throw false;
        }
    }

    async api_login(id, password, token) {
        let info = new URLSearchParams({
            submitted: '1',
            username: id,
            password: password,
            csrf_token: token
        });
        const response = await fetch('https://ankiweb.net/account/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: info.toString()
        });
        const result = await response.text();

        let parser = new DOMParser();
        let doc = parser.parseFromString(result, 'text/html');
        let title = doc.querySelectorAll('h1');
        if (!title.length) throw false;
        if (title[0].textContent.trim() == 'Decks') {
            return true;
        } else {
            throw false;
        }
    }

    async api_save(note, profile) {
        let fields = [];
        for (const field of profile.modelfieldnames[note.modelName]) {
            let fielddata = note.fields[field] ? note.fields[field] : '';
            fields.push(fielddata);
        }

        let data = [fields, note.tags.join(' ')];
        let dict = new URLSearchParams({
            csrf_token: profile.token,
            data: JSON.stringify(data),
            mid: profile.modelids[note.modelName],
            deck: profile.deckids[note.deckName]
        });
        try {
            const response = await fetch('https://ankiuser.net/edit/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: dict.toString()
            });
            return await response.text();
        } catch (e) {
            return null;
        }
    }

    async getProfile(retryCount = 1, forceLogout = false) {
        try {
            let resp = await this.api_connect(forceLogout);
            if (resp.action == 'edit') {
                return resp.data;
            } else if (retryCount > 0 && resp.action == 'login' && await this.api_login(this.id, this.password, resp.data)) {
                return this.getProfile(retryCount - 1);
            } else {
                return null;
            }
        } catch (err) {
            return null;
        }
    }

    async saveNote(note, retryCount = 1) {
        try {
            let resp = await this.api_save(note, this.profile);
            if (resp != null) {
                return true;
            } else if (retryCount > 0 && (this.profile = await this.getProfile())) {
                return this.saveNote(note, retryCount - 1);
            } else {
                return null;
            }
        } catch (err) {
            return null;
        }
    }

    async getAddInfo() {
        try {
            const response = await fetch('https://ankiuser.net/edit/getAddInfo');
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async getNotetypeFields(nid) {
        try {
            const response = await fetch('https://ankiuser.net/edit/getNotetypeFields?ntid=' + nid);
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async parseData(response) {
        const token = /anki\.Editor\('(.*)'/.exec(response)[1];
        const Addinfo = await this.getAddInfo();

        let decknames = [];
        let deckids = {};
        let modelnames = [];
        let modelids = {};
        let modelfieldnames = {};

        for (const deck of Addinfo.decks) {
            decknames.push(deck.name);
            deckids[deck.name] = deck.id;
        }

        for (const notetype of Addinfo.notetypes) {
            modelnames.push(notetype.name);
            modelids[notetype.name] = notetype.id;

            const NotetypeFields = await this.getNotetypeFields(notetype.id);
            let fieldnames = [];
            for (let field of NotetypeFields.fields) {
                fieldnames.push(field.name);
            }
            modelfieldnames[notetype.name] = fieldnames;
        }
        return {
            decknames,
            deckids,
            modelnames,
            modelids,
            modelfieldnames,
            token
        };
    }
}
