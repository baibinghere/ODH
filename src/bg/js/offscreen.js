function sanitizeOptions(options) {
    const defaults = {
        enabled: true,
        mouseselection: true,
        hotkey: '16',
        maxcontext: '1',
        maxexample: '2',
        monolingual: '0',
        preferredaudio: '0',
        services: 'none',
        id: '',
        password: '',
        duplicate: '1',
        tags: 'ODH',
        deckname: 'Default',
        typename: 'Basic',
        expression: 'Front',
        reading: '',
        extrainfo: '',
        definition: 'Back',
        definitions: '',
        sentence: '',
        url: '',
        audio: '',
        sysscripts: 'encn_Collins,encn_Cambridge,encn_Oxford,fren_Cambridge,esen_Spanishdict,decn_Eudict,escn_Eudict,frcn_Eudict',
        udfscripts: '',
        dictSelected: '',
        dictNamelist: [],
    };

    for (const key in defaults) {
        if (!options.hasOwnProperty(key)) {
            options[key] = defaults[key];
        }
    }
    return options;
}

async function optionsLoad() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { target: 'background', action: 'storageGet' },
            (options) => {
                void chrome.runtime.lastError;
                resolve(sanitizeOptions(options || {}));
            }
        );
    });
}

async function optionsSave(options) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { target: 'background', action: 'storageSet', params: { data: sanitizeOptions(options) } },
            () => {
                void chrome.runtime.lastError;
                resolve();
            }
        );
    });
}

class ODHBack {
    constructor() {
        this.audios = {};
        this.options = null;

        this.ankiconnect = new Ankiconnect();
        this.ankiweb = new Ankiweb();
        this.target = null;

        this.deinflector = new Deinflector();
        this.deinflector.loadData();

        this.builtin = new Builtin();
        this.builtin.loadData();

        this.agent = new Agent(document.getElementById('sandbox').contentWindow);

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.target !== 'offscreen') return false;
            this.handleMessage(request.action, request.params || {}, sendResponse);
            return true;
        });

        window.addEventListener('message', e => this.onSandboxMessage(e));
    }

    async handleMessage(action, params, sendResponse) {
        try {
            let result = null;
            switch (action) {
                case 'isConnected':
                    result = await this.opt_getVersion();
                    break;
                case 'getTranslation':
                    result = await this.getTranslationResult(params.expression);
                    break;
                case 'addNote':
                    result = await this.addNoteResult(params.notedef);
                    break;
                case 'playAudio':
                    result = await this.playAudioResult(params.url);
                    break;
                case 'optionsChanged':
                    result = await this.opt_optionsChanged(params);
                    break;
                case 'getDeckNames':
                    result = await this.opt_getDeckNames();
                    break;
                case 'getModelNames':
                    result = await this.opt_getModelNames();
                    break;
                case 'getModelFieldNames':
                    result = await this.opt_getModelFieldNames(params.modelName);
                    break;
                case 'getVersion':
                    result = await this.opt_getVersion();
                    break;
                case 'ankiwebInit':
                    await this.ankiweb.initConnection(params.options, params.forceLogout);
                    result = true;
                    break;
                case 'toggleEnabled':
                    await this.toggleEnabled();
                    break;
                case 'tabReady':
                    this.onTabReady(params.tabId);
                    break;
            }
            sendResponse(result);
        } catch (err) {
            console.error('ODH offscreen error:', action, err);
            sendResponse(null);
        }
    }

    async toggleEnabled() {
        if (!this.options) return;
        this.options.enabled = !this.options.enabled;
        this.setFrontendOptions(this.options);
        optionsSave(this.options);
    }

    onTabReady(tabId) {
        if (this.options) {
            this.tabInvoke(tabId, 'setFrontendOptions', { options: this.options });
        }
    }

    setFrontendOptions(options) {
        chrome.runtime.sendMessage({
            target: 'background',
            action: 'setBadgeText',
            params: { text: options.enabled ? '' : 'off' }
        }, () => void chrome.runtime.lastError);
        this.tabInvokeAll('setFrontendOptions', { options });
    }

    tabInvokeAll(action, params) {
        chrome.runtime.sendMessage({
            target: 'background',
            action: 'tabInvokeAll',
            params: { action, params }
        }, () => void chrome.runtime.lastError);
    }

    tabInvoke(tabId, action, params) {
        chrome.runtime.sendMessage({
            target: 'background',
            action: 'tabInvoke',
            params: { tabId, action, params }
        }, () => void chrome.runtime.lastError);
    }

    formatNote(notedef) {
        let options = this.options;
        if (!options.deckname || !options.typename || !options.expression) {
            console.error('ODH formatNote: missing required options', {
                deckname: options.deckname, typename: options.typename, expression: options.expression
            });
            return null;
        }

        let note = {
            deckName: options.deckname,
            modelName: options.typename,
            options: { allowDuplicate: options.duplicate == '1' ? true : false },
            fields: {},
            tags: []
        };

        let fieldnames = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url'];
        for (const fieldname of fieldnames) {
            if (!options[fieldname]) continue;
            note.fields[options[fieldname]] = notedef[fieldname] || '';
        }

        let tags = options.tags.trim();
        if (tags.length > 0)
            note.tags = tags.split(' ');

        if (options.audio && notedef.audios && notedef.audios.length > 0) {
            note.fields[options.audio] = '';
            let audionumber = Number(options.preferredaudio);
            audionumber = (audionumber && notedef.audios[audionumber]) ? audionumber : 0;
            let audiofile = notedef.audios[audionumber];
            note.audio = {
                'url': audiofile,
                'filename': `ODH_${options.dictSelected}_${encodeURIComponent(notedef.expression)}_${audionumber}.mp3`,
                'fields': [options.audio]
            };
        }

        return note;
    }

    onSandboxMessage(e) {
        const { action, params } = e.data;
        const method = this['api_' + action];
        if (typeof (method) === 'function')
            method.call(this, params);
    }

    async api_initBackend() {
        let options = await optionsLoad();
        this.ankiweb.initConnection(options);

        if (options.dictLibrary) {
            options.sysscripts = options.dictLibrary;
            options.dictLibrary = '';
        }
        if (options.dictSelected === 'builtin_encn_Collins') {
            options.dictSelected = '';
        }
        this.opt_optionsChanged(options);
    }

    async api_Fetch(params) {
        let { url, callbackId } = params;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await response.text();
            this.callback(data, callbackId);
        } catch (e) {
            this.callback(null, callbackId);
        }
    }

    async api_Deinflect(params) {
        let { word, callbackId } = params;
        this.callback(this.deinflector.deinflect(word), callbackId);
    }

    async api_getBuiltin(params) {
        let { dict, word, callbackId } = params;
        this.callback(this.builtin.findTerm(dict, word), callbackId);
    }

    async api_getLocale(params) {
        let { callbackId } = params;
        this.callback(navigator.language || 'en', callbackId);
    }

    async getTranslationResult(expression) {
        if (expression.endsWith('.')) {
            expression = expression.slice(0, -1);
        }
        try {
            return await this.findTerm(expression);
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async addNoteResult(notedef) {
        const note = this.formatNote(notedef);
        if (!note) {
            console.error('ODH addNote: formatNote returned null, notedef was:', notedef);
            return null;
        }
        console.log('ODH addNote: sending to AnkiConnect:', JSON.stringify(note, null, 2));
        try {
            const result = await this.target.addNote(note);
            if (result === null) {
                console.error('ODH addNote: AnkiConnect returned null (check AnkiConnect error above)');
            }
            return result;
        } catch (err) {
            console.error('ODH addNote error:', err);
            return null;
        }
    }

    async playAudioResult(url) {
        for (let key in this.audios) {
            this.audios[key].pause();
        }
        try {
            const audio = this.audios[url] || new Audio(url);
            audio.currentTime = 0;
            audio.play();
            this.audios[url] = audio;
            return true;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async opt_optionsChanged(options) {
        this.setFrontendOptions(options);

        switch (options.services) {
            case 'none':
                this.target = null;
                break;
            case 'ankiconnect':
                this.target = this.ankiconnect;
                break;
            case 'ankiweb':
                this.target = this.ankiweb;
                break;
            default:
                this.target = null;
        }

        let defaultscripts = ['encn_Collins'];
        let newscripts = `${options.sysscripts},${options.udfscripts}`;
        let loadresults = null;
        if (!this.options || (`${this.options.sysscripts},${this.options.udfscripts}` != newscripts)) {
            const scriptsset = Array.from(new Set(defaultscripts.concat(newscripts.split(',').filter(x => x).map(x => x.trim()))));
            loadresults = await this.loadScripts(scriptsset);
        }

        this.options = options;
        if (loadresults) {
            let namelist = loadresults.map(x => x.result.objectname);
            this.options.dictSelected = namelist.includes(options.dictSelected) ? options.dictSelected : namelist[0];
            this.options.dictNamelist = loadresults.map(x => x.result);
        }
        await this.setScriptsOptions(this.options);
        optionsSave(this.options);
        return this.options;
    }

    async opt_getDeckNames() {
        return this.target ? await this.target.getDeckNames() : null;
    }

    async opt_getModelNames() {
        return this.target ? await this.target.getModelNames() : null;
    }

    async opt_getModelFieldNames(modelName) {
        return this.target ? await this.target.getModelFieldNames(modelName) : null;
    }

    async opt_getVersion() {
        return this.target ? await this.target.getVersion() : null;
    }

    async loadScripts(list) {
        let promises = list.map((name) => this.loadScript(name));
        let results = await Promise.all(promises);
        return results.filter(x => { if (x.result) return x.result; });
    }

    async loadScript(name) {
        return new Promise((resolve) => {
            this.agent.postMessage('loadScript', { name }, result => resolve(result));
        });
    }

    async setScriptsOptions(options) {
        return new Promise((resolve) => {
            this.agent.postMessage('setScriptsOptions', { options }, result => resolve(result));
        });
    }

    async findTerm(expression) {
        return new Promise((resolve) => {
            this.agent.postMessage('findTerm', { expression }, result => resolve(result));
        });
    }

    callback(data, callbackId) {
        this.agent.postMessage('callback', { data, callbackId });
    }
}

window.odhback = new ODHBack();
