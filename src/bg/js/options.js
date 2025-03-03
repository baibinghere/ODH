/* global localizeHtmlPage, utilAsync */

// Default options
const defaultOptions = {
    enabled: true,
    mouseselection: true,
    hotkey: '16',

    dictSelected: 'builtin_encn_Collins',
    monolingual: '0',
    preferredaudio: '0',
    maxcontext: '1',
    maxexample: '2',

    services: 'none',
    id: '',
    password: '',

    tags: 'ODH',
    duplicate: '0',

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

    sysscripts: 'builtin_encn_Collins',
    udfscripts: '',

    dictNamelist: []
};

// Load options from storage
async function optionsLoad() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(defaultOptions, (options) => {
            resolve(options);
        });
    });
}

// Save options to storage
async function optionsSave(options) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(options, () => {
            resolve();
        });
    });
}

// 为 Service Worker 环境导出函数
if (typeof self !== 'undefined') {
    self.optionsLoad = optionsLoad;
    self.optionsSave = optionsSave;
}

// The following code is for the options page UI
async function populateAnkiDeckAndModel(options, odhback) {
    let names = [];
    $('#deckname').empty();
    names = await odhback.opt_getDeckNames();
    if (names !== null) {
        names.forEach(name => $('#deckname').append($('<option>', { value: name, text: name })));
    }
    $('#deckname').val(options.deckname);

    $('#typename').empty();
    names = await odhback.opt_getModelNames();
    if (names !== null) {
        names.forEach(name => $('#typename').append($('<option>', { value: name, text: name })));
    }
    $('#typename').val(options.typename);
}

async function populateAnkiFields(options, odhback) {
    const modelName = $('#typename').val() || options.typename;
    if (modelName === null) return;

    let names = await odhback.opt_getModelFieldNames(modelName);
    if (names == null) return;

    let fields = ['expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        $(`#${field}`).empty();
        $(`#${field}`).append($('<option>', { value: '', text: '' }));
        names.forEach(name => $(`#${field}`).append($('<option>', { value: name, text: name })));
        $(`#${field}`).val(options[field]);
    });
}

async function updateAnkiStatus(options, odhback) {
    $('#services-status').text(chrome.i18n.getMessage('msgConnecting'));
    $('#anki-options').hide();
    if (options.services == 'ankiweb')
        $('#user-options').show();
    else {
        $('#user-options').hide();
    }

    let version = await odhback.opt_getVersion();
    if (version === null) {
        $('#services-status').text(chrome.i18n.getMessage('msgFailed'));
    } else {
        populateAnkiDeckAndModel(options, odhback);
        populateAnkiFields(options, odhback);
        $('#services-status').text(chrome.i18n.getMessage('msgSuccess', [version]));
        $('#anki-options').show();
        if (options.services == 'ankiconnect')
            $('#duplicate-option').show();
        else {
            $('#duplicate-option').hide();
        }
    }
}

function populateDictionary(dicts) {
    $('#dict').empty();
    dicts.forEach(item => $('#dict').append($('<option>', { value: item.objectname, text: item.displayname })));
}

function populateSysScriptsList(dictLibrary) {
    const optionscripts = Array.from(new Set(dictLibrary.split(',').filter(x => x).map(x => x.trim())));
    let systemscripts = [
        'builtin_encn_Collins', 'general_Makenotes',//default & builtin script
        'cncn_Zdic', //cn-cn dictionary
        'encn_Collins', 'encn_Cambridge', 'encn_Cambridge_tc', 'encn_Oxford', 'encn_Youdao', 'encn_Baicizhan', //en-cn dictionaries
        'enen_Collins', 'enen_LDOCE6MDX', 'enen_UrbanDict', //en-en dictionaries
        'enfr_Cambridge', 'enfr_Collins', //en-fr dictionaries
        'fren_Cambridge', 'fren_Collins', //fr-cn dictionaries
        'esen_Spanishdict', 'decn_Eudict', 'escn_Eudict', 'frcn_Eudict', 'frcn_Youdao', 'rucn_Qianyi' //msci dictionaries
    ];
    $('#scriptslistbody').empty();
    systemscripts.forEach(script => {
        let row = '';
        row += `<input class="sl-col sl-col-onoff" type="checkbox" ${optionscripts.includes(script) || optionscripts.includes('lib://'+script)?'checked':''}>`;
        row += `<input class="sl-col sl-col-cloud" type="checkbox" ${optionscripts.includes('lib://'+script)?'checked':''}>`;
        row += `<span class="sl-col sl-col-name">${script}</span>`;
        row += `<span class="sl-col sl-col-description">${chrome.i18n.getMessage(script)}</span>`;
        $('#scriptslistbody').append($(`<div class="sl-row">${row}</div>`));
    });

    $('.sl-col-onoff', '.sl-row:nth-child(1)').prop('checked', true); // make default script(first row) always active.
    $('.sl-col-cloud', '.sl-row:nth-child(1)').prop('checked', false); // make default script(first row) as local script.
    $('.sl-col-cloud, .sl-col-onoff', '.sl-row:nth-child(1)').css({ 'visibility': 'hidden' }); //make default sys script untouch
}

function onScriptListChange() {
    let dictLibrary = [];
    $('.sl-row').each(function() {
        if ($('.sl-col-onoff', this).prop('checked') == true)
            dictLibrary.push($('.sl-col-cloud', this).prop('checked') ? 'lib://' + $('.sl-col-name', this).text() : $('.sl-col-name', this).text());
    });
    $('#sysscripts').val(dictLibrary.join());
}

function onHiddenClicked() {
    $('.sl-col-cloud').toggleClass('hidden');
}

async function onAnkiTypeChanged(e, odhback) {
    if (e.originalEvent) {
        let options = await optionsLoad();
        populateAnkiFields(options, odhback);
    }
}

async function onLoginClicked(e, odhback) {
    if (e.originalEvent) {
        let options = await optionsLoad();
        options.id = $('#id').val();
        options.password = $('#password').val();

        $('#services-status').text(chrome.i18n.getMessage('msgConnecting'));
        await odhback.ankiweb.initConnection(options, true); // set param forceLogout = true

        let newOptions = await odhback.opt_optionsChanged(options);
        updateAnkiStatus(newOptions, odhback);
    }
}

async function onServicesChanged(e, odhback) {
    if (e.originalEvent) {
        let options = await optionsLoad();
        options.services = $('#services').val();
        let newOptions = await odhback.opt_optionsChanged(options);
        updateAnkiStatus(newOptions, odhback);
    }
}

async function onSaveClicked(e, odhback) {
    if (!e.originalEvent) return;

    let optionsOld = await optionsLoad();
    let options = $.extend(true, {}, optionsOld);

    options.enabled = $('#enabled').prop('checked');
    options.mouseselection = $('#mouseselection').prop('checked');
    options.hotkey = $('#hotkey').val();

    options.dictSelected = $('#dict').val();
    options.monolingual = $('#monolingual').val();
    options.preferredaudio = $('#anki-preferred-audio').val();
    options.maxcontext = $('#maxcontext').val();
    options.maxexample = $('#maxexample').val();

    options.services = $('#services').val();
    options.id = $('#id').val();
    options.password = $('#password').val();
    
    options.tags = $('#tags').val();
    options.duplicate = $('#duplicate').val();

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        options[field] = $(`#${field}`).val() == null ? options[field] : $(`#${field}`).val();
    });

    options.sysscripts = $('#sysscripts').val();
    options.udfscripts = $('#udfscripts').val();

    $('#gif-load').show();
    let newOptions = await odhback.opt_optionsChanged(options);
    $('.gif').hide();
    $('#gif-good').show(1000, () => { $('.gif').hide(); });

    populateDictionary(newOptions.dictNamelist);
    $('#dict').val(newOptions.dictSelected);

    if (e.target.id == 'saveclose')
        window.close();
}

function onCloseClicked(e) {
    window.close();
}

async function onReady(odhback) {
    localizeHtmlPage();
    let options = await optionsLoad();
    $('#enabled').prop('checked', options.enabled);
    $('#mouseselection').prop('checked', options.mouseselection);
    $('#hotkey').val(options.hotkey);

    populateDictionary(options.dictNamelist);
    $('#dict').val(options.dictSelected);

    $('#monolingual').val(options.monolingual);
    $('#anki-preferred-audio').val(options.preferredaudio);
    $('#maxcontext').val(options.maxcontext);
    $('#maxexample').val(options.maxexample);

    $('#services').val(options.services);
    $('#id').val(options.id);
    $('#password').val(options.password);

    $('#tags').val(options.tags);
    $('#duplicate').val(options.duplicate);

    let fields = ['deckname', 'typename', 'expression', 'reading', 'extrainfo', 'definition', 'definitions', 'sentence', 'url', 'audio'];
    fields.forEach(field => {
        $(`#${field}`).val(options[field]);
    });

    $('#sysscripts').val(options.sysscripts);
    $('#udfscripts').val(options.udfscripts);
    populateSysScriptsList(options.sysscripts);
    onHiddenClicked();

    $('#login').click(e => onLoginClicked(e, odhback));
    $('#saveload').click(e => onSaveClicked(e, odhback));
    $('#saveclose').click(e => onSaveClicked(e, odhback));
    $('#close').click(onCloseClicked);
    $('.gif').hide();

    $('.sl-col-onoff, .sl-col-cloud').click(onScriptListChange);
    $('#hidden').click(onHiddenClicked);
    $('#typename').change(e => onAnkiTypeChanged(e, odhback));
    $('#services').change(e => onServicesChanged(e, odhback));

    updateAnkiStatus(options, odhback);
}

// Initialize the options page when the document is ready
// This is only used in the options page
if (typeof $ !== 'undefined') {
    $(document).ready(async () => {
        try {
            // 在 Manifest V3 中，使用消息传递替代 getBackgroundPage
            const odhbackProxy = await (async function() {
                // 创建一个代理对象，将所有方法调用转换为消息
                return new Proxy({}, {
                    get: function(target, prop) {
                        return async function(...args) {
                            return new Promise((resolve, reject) => {
                                chrome.runtime.sendMessage({
                                    action: prop,
                                    params: args[0] || {}
                                }, response => {
                                    if (chrome.runtime.lastError) {
                                        console.error('Error sending message:', chrome.runtime.lastError);
                                        reject(chrome.runtime.lastError);
                                    } else {
                                        resolve(response);
                                    }
                                });
                            });
                        };
                    }
                });
            })();
            
            utilAsync(onReady)(odhbackProxy);
        } catch (error) {
            console.error('Error initializing options page:', error);
        }
    });
}