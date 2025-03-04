import {Ankiconnect} from "./ankiconnect.js";
import {Builtin} from "./builtin.js";
import {Deinflector} from "./deinflector.js";
import {Ankiweb} from "./ankiweb.js";

export class ODHBack {
    constructor() {
        this.audios = {};
        this.options = null;

        this.ankiconnect = new Ankiconnect();
        this.ankiweb = new Ankiweb();
        this.target = null;

        //setup lemmatizer
        this.deinflector = new Deinflector();
        this.deinflector.loadData();

        //Setup builtin dictionary data
        this.builtin = new Builtin();
        this.builtin.loadData();

        // Remove Agent initialization as it requires DOM
        // this.agent = new Agent(document.getElementById('sandbox').contentWindow);

        // Service Worker specific listeners
        this.setupListeners();
    }

    setupListeners() {
        // Service Worker specific event listeners
        chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
        chrome.commands.onCommand.addListener((command) => this.onCommand(command));
    }

    onCommand(command) {
        if (command !== 'enabled') return;
        this.options.enabled = !this.options.enabled;
        this.setFrontendOptions(this.options);
        this.optionsSave(this.options);
    }

    onInstalled(details) {
        if (details.reason === 'install') {
            chrome.tabs.create({ url: chrome.runtime.getURL('bg/guide.html') });
            return;
        }
        if (details.reason === 'update') {
            chrome.tabs.create({ url: chrome.runtime.getURL('bg/update.html') });
            return;
        }
    }

    setFrontendOptions(options) {
        if (!options) return;

        switch (options.enabled) {
            case false:
                chrome.action.setBadgeText({ text: 'off' });
                break;
            case true:
                chrome.action.setBadgeText({ text: '' });
                break;
        }

        // Notify all tabs about the options change
        this.broadcastMessage('setFrontendOptions', { options });
    }

    // Helper method to broadcast message to all tabs
    async broadcastMessage(action, params) {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action, params });
            } catch (error) {
                console.warn(`Failed to send message to tab ${tab.id}:`, error);
            }
        }
    }

    // Message handling
    async handleMessage(request) {
        const { action, params } = request;
        const method = this['api_' + action];

        if (typeof method === 'function') {
            try {
                return await method.call(this, params);
            } catch (error) {
                console.error(`Error in ${action}:`, error);
                throw error;
            }
        }
        throw new Error(`Unknown action: ${action}`);
    }

    async api_initBackend(params) {
        try {
            const options = await this.optionsLoad();
            await this.ankiweb.initConnection(options);

            if (options.dictLibrary) {
                options.sysscripts = options.dictLibrary;
                options.dictLibrary = '';
            }

            await this.opt_optionsChanged(options);
            return { success: true };
        } catch (error) {
            console.error('Failed to initialize backend:', error);
            throw error;
        }
    }

    checkLastError(){
        // NOP
    }

    tabInvokeAll(action, params) {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                this.tabInvoke(tab.id, action, params);
            }
        });
    }

    tabInvoke(tabId, action, params) {
        const callback = () => this.checkLastError(chrome.runtime.lastError);
        chrome.tabs.sendMessage(tabId, { action, params }, callback);
    }

    formatNote(notedef) {
        let options = this.options;
        if (!options.deckname || !options.typename || !options.expression)
            return null;

        let note = {
            deckName: options.deckname,
            modelName: options.typename,
            options: { allowDuplicate: options.duplicate === '1' },
            fields: {},
            tags: []
        };

        let fieldnames = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url'];
        for (const fieldname of fieldnames) {
            if (!options[fieldname]) continue;
            note.fields[options[fieldname]] = notedef[fieldname];
        }

        let tags = options.tags.trim();
        if (tags.length > 0)
            note.tags = tags.split(' ');

        if (options.audio && notedef.audios.length > 0) {
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

    // Helper methods for options
    async optionsLoad() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (options) => {
                resolve(options || {});
            });
        });
    }

    async optionsSave(options) {
        return new Promise((resolve) => {
            chrome.storage.local.set(options, () => {
                resolve();
            });
        });
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

        let defaultscripts = ['builtin_encn_Collins'];
        let newscripts = `${options.sysscripts},${options.udfscripts}`;
        let loadresults = null;
        if (!this.options || (`${this.options.sysscripts},${this.options.udfscripts}` !== newscripts)) {
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
        await this.optionsSave(this.options);
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
        return new Promise((resolve, reject) => {
            // Placeholder for loadScript method
            resolve({ result: { objectname: name } });
        });
    }

    async setScriptsOptions(options) {
        return new Promise((resolve, reject) => {
            // Placeholder for setScriptsOptions method
            resolve({ result: { objectname: 'setScriptsOptions' } });
        });
    }

    async findTerm(expression) {
        return new Promise((resolve, reject) => {
            // Placeholder for findTerm method
            resolve({ result: expression });
        });
    }

    callback(data, callbackId) {
        // Placeholder for callback method
    }
}