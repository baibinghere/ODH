/* global Ankiconnect, Ankiweb, Deinflector, Builtin, Agent, optionsLoad, optionsSave, WorkerManager */

// 确保所有依赖都已加载
if (typeof Ankiconnect !== 'function') {
    console.error('Ankiconnect is not defined');
}
if (typeof Ankiweb !== 'function') {
    console.error('Ankiweb is not defined');
}
if (typeof Deinflector !== 'function') {
    console.error('Deinflector is not defined');
}
if (typeof Builtin !== 'function') {
    console.error('Builtin is not defined');
}
if (typeof WorkerManager !== 'function') {
    console.error('WorkerManager is not defined');
}
if (typeof optionsLoad !== 'function') {
    console.error('optionsLoad is not defined');
}
if (typeof optionsSave !== 'function') {
    console.error('optionsSave is not defined');
}

class ODHBack {
    constructor() {
        console.log('Initializing ODHBack...');
        this.audios = {};
        this.options = null;

        try {
            this.ankiconnect = new Ankiconnect();
            console.log('Ankiconnect initialized');
        } catch (error) {
            console.error('Error initializing Ankiconnect:', error);
        }

        try {
            this.ankiweb = new Ankiweb();
            console.log('Ankiweb initialized');
        } catch (error) {
            console.error('Error initializing Ankiweb:', error);
        }

        this.target = null;

        try {
            //setup lemmatizer
            this.deinflector = new Deinflector();
            this.deinflector.loadData();
            console.log('Deinflector initialized');
        } catch (error) {
            console.error('Error initializing Deinflector:', error);
        }

        try {
            //Setup builtin dictionary data
            this.builtin = new Builtin();
            this.builtin.loadData();
            console.log('Builtin initialized');
        } catch (error) {
            console.error('Error initializing Builtin:', error);
        }

        try {
            // Initialize dictionary manager
            this.workerManager = new WorkerManager();
            console.log('WorkerManager initialized');
        } catch (error) {
            console.error('Error initializing WorkerManager:', error);
        }

        // Set up messaging system
        this.setupMessaging();

        try {
            chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
            chrome.tabs.onCreated.addListener((tab) => this.onTabReady(tab.id));
            chrome.tabs.onUpdated.addListener(this.onTabReady.bind(this));
            chrome.commands.onCommand.addListener((command) => this.onCommand(command));
            console.log('Event listeners set up');
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
        
        console.log('ODHBack initialized successfully');
    }

    setupMessaging() {
        try {
            chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
            console.log('Messaging system set up');
        } catch (error) {
            console.error('Error setting up messaging system:', error);
        }
    }

    onCommand(command) {
        if (command != 'enabled') return;
        if (!this.options) {
            console.error('Options not initialized');
            return;
        }
        this.options.enabled = !this.options.enabled;
        this.setFrontendOptions(this.options);
        optionsSave(this.options);
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

    onTabReady(tabId) {
        if (!this.options) {
            console.warn('Options not initialized, skipping onTabReady');
            return;
        }
        this.tabInvoke(tabId, 'setFrontendOptions', { options: this.options });
    }

    setFrontendOptions(options) {
        if (!options) {
            console.error('Cannot set frontend options: options is null');
            return;
        }
        
        try {
            switch (options.enabled) {
                case false:
                    chrome.action.setBadgeText({ text: 'off' });
                    break;
                case true:
                    chrome.action.setBadgeText({ text: '' });
                    break;
            }
            this.tabInvokeAll('setFrontendOptions', {
                options
            });
        } catch (error) {
            console.error('Error setting frontend options:', error);
        }
    }

    checkLastError(){
        if (chrome.runtime.lastError) {
            console.warn('Chrome runtime error:', chrome.runtime.lastError);
        }
    }

    tabInvokeAll(action, params) {
        try {
            chrome.tabs.query({}, (tabs) => {
                for (let tab of tabs) {
                    this.tabInvoke(tab.id, action, params);
                }
            });
        } catch (error) {
            console.error('Error invoking all tabs:', error);
        }
    }

    tabInvoke(tabId, action, params) {
        try {
            const callback = () => this.checkLastError(chrome.runtime.lastError);
            chrome.tabs.sendMessage(tabId, { action, params }, callback);
        } catch (error) {
            console.error(`Error invoking tab ${tabId}:`, error);
        }
    }

    formatNote(notedef) {
        let options = this.options;
        if (!options || !options.deckname || !options.typename || !options.expression)
            return null;

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
            note.fields[options[fieldname]] = notedef[fieldname];
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

    // Message Hub and Handler start from here ...
    onMessage(request, sender, callback) {
        try {
            console.log('Received message:', request);
            const { action, params } = request;
            const method = this['api_' + action];

            if (typeof(method) === 'function') {
                params.callback = callback;
                method.call(this, params);
            } else {
                console.warn(`Method api_${action} not found`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
        return true;
    }

    async api_initBackend(params) {
        console.log('api_initBackend called with params:', params);
        try {
            let options = await optionsLoad();
            if (options) {
                console.log('Options loaded in api_initBackend:', options);
            } else {
                console.warn('No options found in api_initBackend');
            }
            
            if (this.ankiweb && typeof this.ankiweb.initConnection === 'function') {
                await this.ankiweb.initConnection(options);
                console.log('Ankiweb connection initialized');
            } else {
                console.error('ankiweb.initConnection is not available');
            }

            //to do: will remove it late after all users migrate to new version.
            if (options.dictLibrary) { // to migrate legacy scripts list to new list.
                options.sysscripts = options.dictLibrary;
                options.dictLibrary = '';
            }
            
            if (typeof this.opt_optionsChanged === 'function') {
                const newOptions = await this.opt_optionsChanged(options);
                console.log('Options changed successfully');
                return newOptions;
            } else {
                console.error('opt_optionsChanged is not available');
                return options;
            }
        } catch (error) {
            console.error('Error in api_initBackend:', error);
            return null;
        }
    }

    async api_Fetch(params) {
        let { url, callbackId } = params;

        try {
            const response = await fetch(url, {
                method: 'GET',
                timeout: 3000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.text();
            this.callback(data, callbackId);
        } catch (error) {
            console.error('Fetch error:', error);
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
        this.callback(chrome.i18n.getUILanguage(), callbackId);
    }

    // front end message handler
    async api_isConnected(params) {
        let callback = params.callback;
        callback(await this.opt_getVersion());
    }

    async api_getTranslation(params) {
        let { expression, callback } = params;

        // Fix https://github.com/ninja33/ODH/issues/97
        if (expression.endsWith(".")) {
            expression = expression.slice(0, -1);
        }

        try {
            let result = await this.findTerm(expression);
            callback(result);
        } catch (err) {
            console.error(err);
            callback(null);
        }
    }

    async api_addNote(params) {
        let { notedef, callback } = params;

        const note = this.formatNote(notedef);
        try {
            let result = await this.target.addNote(note);
            callback(result);
        } catch (err) {
            console.error(err);
            callback(null);
        }
    }

    async api_playAudio(params) {
        let { url, callback } = params;
        
        for (let key in this.audios) {
            this.audios[key].pause();
        }

        try {
            const audio = this.audios[url] || new Audio(url);
            audio.currentTime = 0;
            audio.play();
            this.audios[url] = audio;
            callback(true);
        } catch (err) {
            console.error(err);
            callback(null);
        }
    }

    // Option page and Brower Action page requests handlers.
    async opt_optionsChanged(options) {
        try {
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
            if (!this.options || (`${this.options.sysscripts},${this.options.udfscripts}` != newscripts)) {
                const scriptsset = Array.from(new Set(defaultscripts.concat(newscripts.split(',').filter(x => x).map(x => x.trim()))));
                loadresults = await this.loadScripts(scriptsset);
            }

            this.options = options;
            if (loadresults) {
                let namelist = loadresults.map(x => x.objectname);
                this.options.dictSelected = namelist.includes(options.dictSelected) ? options.dictSelected : namelist[0];
                this.options.dictNamelist = loadresults;
            }
            
            if (typeof this.setScriptsOptions === 'function') {
                await this.setScriptsOptions(this.options);
            } else {
                console.error('setScriptsOptions is not available');
            }
            
            await optionsSave(this.options);
            return this.options;
        } catch (error) {
            console.error('Error in opt_optionsChanged:', error);
            return options;
        }
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

    // Dictionary script management
    async loadScripts(list) {
        try {
            let promises = list.map((name) => this.loadScript(name));
            let results = await Promise.all(promises);
            return results.filter(x => x);
        } catch (error) {
            console.error('Error loading scripts:', error);
            return [];
        }
    }

    async loadScript(name) {
        try {
            // Fetch the script content
            const response = await fetch(chrome.runtime.getURL(`/bg/js/dictionary/${name}.js`));
            if (!response.ok) {
                console.error(`Failed to load script ${name}: ${response.status} ${response.statusText}`);
                return null;
            }
            
            const code = await response.text();
            
            // Load the script into the dictionary manager
            if (this.workerManager && typeof this.workerManager.loadScript === 'function') {
                await this.workerManager.loadScript(name, code);
                
                // Execute the script to get metadata
                if (typeof this.workerManager.executeScript === 'function') {
                    const result = await this.workerManager.executeScript(name, { action: 'getMetadata' });
                    return result;
                } else {
                    console.error('workerManager.executeScript is not available');
                    return null;
                }
            } else {
                console.error('workerManager.loadScript is not available');
                return null;
            }
        } catch (error) {
            console.error(`Error loading script ${name}:`, error);
            return null;
        }
    }

    async setScriptsOptions(options) {
        try {
            if (!options.dictNamelist || !Array.isArray(options.dictNamelist)) {
                console.error('dictNamelist is not an array:', options.dictNamelist);
                return null;
            }
            
            if (!this.workerManager || typeof this.workerManager.executeScript !== 'function') {
                console.error('workerManager.executeScript is not available');
                return null;
            }
            
            const results = await Promise.all(
                options.dictNamelist.map(dict => 
                    this.workerManager.executeScript(dict.objectname, { 
                        action: 'setOptions', 
                        options 
                    })
                )
            );
            return results;
        } catch (error) {
            console.error('Error setting scripts options:', error);
            return null;
        }
    }

    async findTerm(expression) {
        try {
            if (!this.options) {
                console.error('Options not initialized');
                return null;
            }
            
            const dict = this.options.dictSelected;
            if (!dict) {
                console.error('No dictionary selected');
                return null;
            }
            
            if (!this.workerManager || typeof this.workerManager.executeScript !== 'function') {
                console.error('workerManager.executeScript is not available');
                return null;
            }
            
            const result = await this.workerManager.executeScript(dict, {
                action: 'findTerm',
                expression
            });
            return result;
        } catch (error) {
            console.error('Error finding term:', error);
            return null;
        }
    }

    callback(data, callbackId) {
        // This is used to send data back to content scripts
        // In MV3, we need to use messaging system instead
        if (callbackId) {
            try {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs && tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'callback',
                            params: { data, callbackId }
                        });
                    } else {
                        console.warn('No active tabs found');
                    }
                });
            } catch (error) {
                console.error('Error sending callback:', error);
            }
        }
    }
}

// 为 Service Worker 环境导出类和实例
if (typeof self !== 'undefined') {
    console.log('Exporting ODHBack to Service Worker environment');
    // 导出 ODHBack 类
    self.ODHBack = ODHBack;
    
    // 创建并导出 odhback 实例
    try {
        console.log('Creating odhback instance');
        self.odhback = new ODHBack();
        console.log('odhback instance created successfully');
        
        // 验证 api_initBackend 方法是否可用
        if (typeof self.odhback.api_initBackend !== 'function') {
            console.error('api_initBackend method is not available after initialization');
        } else {
            console.log('api_initBackend method is available');
        }
    } catch (error) {
        console.error('Error creating odhback instance:', error);
    }
}