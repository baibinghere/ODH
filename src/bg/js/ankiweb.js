class Ankiweb {
    constructor() {
        this.profile = null;
        this.version = 'web';
        this.id = '';
        this.password = '';
        // Note: In MV3, we use declarativeNetRequest instead of webRequest
        // The rules are defined in rules.json
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

    // 创建一个更健壮的 HTML 解析函数，用于替代 DOMParser
    parseHTML(html) {
        try {
            console.log('Parsing HTML with custom parser');
            
            // 记录 HTML 的前 200 个字符，用于调试
            console.log('HTML preview:', html.substring(0, 200) + '...');
            
            // 尝试多种方式提取标题
            let title = '';
            
            // 方法 1: 使用 <h1> 标签
            const h1Match = /<h1[^>]*>(.*?)<\/h1>/i.exec(html);
            if (h1Match) {
                title = h1Match[1].trim();
                console.log('Found title using h1 tag:', title);
            }
            
            // 方法 2: 使用 <title> 标签
            if (!title) {
                const titleTagMatch = /<title[^>]*>(.*?)<\/title>/i.exec(html);
                if (titleTagMatch) {
                    const fullTitle = titleTagMatch[1].trim();
                    console.log('Found page title:', fullTitle);
                    
                    // 从 title 中提取关键词
                    if (fullTitle.includes('Add')) {
                        title = 'Add';
                    } else if (fullTitle.includes('Log in') || fullTitle.includes('Login')) {
                        title = 'Log in';
                    } else if (fullTitle.includes('Decks')) {
                        title = 'Decks';
                    }
                    
                    console.log('Extracted title from page title:', title);
                }
            }
            
            // 方法 3: 检查页面内容特征
            if (!title) {
                if (html.includes('anki.Editor')) {
                    title = 'Add';
                    console.log('Detected Add page based on content');
                } else if (html.includes('name="csrf_token"') && html.includes('name="password"')) {
                    title = 'Log in';
                    console.log('Detected Login page based on content');
                } else if (html.includes('class="deck"') || html.includes('deckBrowser')) {
                    title = 'Decks';
                    console.log('Detected Decks page based on content');
                }
            }
            
            // 提取 CSRF token
            let csrfToken = '';
            const csrfMatch = /<input[^>]*name=["']csrf_token["'][^>]*value=["']([^"']+)["'][^>]*>/i.exec(html);
            if (csrfMatch) {
                csrfToken = csrfMatch[1];
                console.log('Found CSRF token:', csrfToken);
            } else {
                console.warn('CSRF token not found');
            }
            
            return {
                title,
                csrfToken
            };
        } catch (error) {
            console.error('Error parsing HTML:', error);
            return { title: '', csrfToken: '' };
        }
    }

    // --- Ankiweb API
    async api_connect(forceLogout = false) {
        try {
            const url = forceLogout ? 'https://ankiweb.net/account/logout' : 'https://ankiuser.net/edit/';
            console.log(`Connecting to ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.text();
            console.log('Received response, parsing HTML');
            
            // 使用自定义解析函数替代 DOMParser
            const parsedHTML = this.parseHTML(result);
            
            if (!parsedHTML.title) {
                console.error('No title found in response. Response preview:', result.substring(0, 500) + '...');
                throw new Error('No title found in response');
            }
            
            console.log(`Page title: ${parsedHTML.title}`);
            
            switch (parsedHTML.title) {
                case 'Add':
                    return {
                        action: 'edit',
                        data: await this.parseData(result)
                    };
                case 'Log in':
                    if (!parsedHTML.csrfToken) {
                        console.error('CSRF token not found on login page');
                        throw new Error('CSRF token not found');
                    }
                    return {
                        action: 'login',
                        data: parsedHTML.csrfToken
                    };
                default:
                    console.warn(`Unknown page title: ${parsedHTML.title}`);
                    // 如果是未知标题但包含 token，尝试作为 edit 页面处理
                    if (result.includes('anki.Editor')) {
                        console.log('Page contains Editor, treating as Edit page');
                        return {
                            action: 'edit',
                            data: await this.parseData(result)
                        };
                    }
                    throw new Error(`Unknown page title: ${parsedHTML.title}`);
            }
        } catch (error) {
            console.error('Error in api_connect:', error);
            return null;
        }
    }

    async api_login(id, password, token) {
        try {
            console.log(`Attempting to login with username: ${id.substring(0, 3)}*** and token`);
            
            if (!token) {
                console.error('CSRF token is missing for login');
                throw new Error('CSRF token is missing');
            }
            
            const info = {
                submitted: '1',
                username: id,
                password: password,
                csrf_token: token
            };
            
            console.log('Preparing form data for login');
            const formData = new URLSearchParams();
            for (const [key, value] of Object.entries(info)) {
                formData.append(key, value);
            }
            
            console.log('Sending login request to ankiweb.net/account/login');
            const response = await fetch('https://ankiweb.net/account/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'text/html,application/xhtml+xml,application/xml',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                body: formData,
                credentials: 'include',
                redirect: 'follow'
            });
            
            if (!response.ok) {
                console.error(`HTTP error during login! status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('Login response received, status:', response.status);
            console.log('Response URL:', response.url);
            
            // 检查重定向 URL
            if (response.url.includes('login')) {
                console.warn('Still on login page after submission, login likely failed');
            }
            
            const result = await response.text();
            console.log('Login response text length:', result.length);
            
            // 使用自定义解析函数替代 DOMParser
            const parsedHTML = this.parseHTML(result);
            console.log('Parsed login response, title:', parsedHTML.title);
            
            // 检查登录是否成功
            const isSuccess = parsedHTML.title === 'Decks' || 
                             result.includes('deckBrowser') || 
                             result.includes('class="deck"') ||
                             !result.includes('login');
            
            if (isSuccess) {
                console.log('Login successful');
            } else {
                console.warn('Login appears to have failed');
                console.log('Response preview:', result.substring(0, 500) + '...');
            }
            
            return isSuccess;
        } catch (error) {
            console.error('Error in api_login:', error);
            return false;
        }
    }

    async api_save(note, profile) {
        try {
            let fields = [];
            for (const field of profile.modelfieldnames[note.modelName]) {
                let fielddata = note.fields[field] ? note.fields[field] : '';
                fields.push(fielddata);
            }

            let data = [fields, note.tags.join(' ')];
            
            const dict = {
                csrf_token: profile.token,
                data: JSON.stringify(data),
                mid: profile.modelids[note.modelName],
                deck: profile.deckids[note.deckName]
            };
            
            const formData = new URLSearchParams();
            for (const [key, value] of Object.entries(dict)) {
                formData.append(key, value);
            }
            
            const response = await fetch('https://ankiuser.net/edit/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.text();
        } catch (error) {
            console.error('Error in api_save:', error);
            return null;
        }
    }

    async getProfile(retryCount = 1, forceLogout = false) {
        try {
            let resp = await this.api_connect(forceLogout);
            if (!resp) return null;
            
            if (resp.action == 'edit') {
                return resp.data;
            } else if (retryCount > 0 && resp.action == 'login' && await this.api_login(this.id, this.password, resp.data)) {
                return this.getProfile(retryCount - 1);
            } else {
                return null;
            }
        } catch (err) {
            console.error('Error in getProfile:', err);
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
            console.error('Error in saveNote:', err);
            return null;
        }
    }

    async getAddInfo() {
        try {
            console.log('Fetching add info from ankiuser.net/edit/getAddInfo');
            
            const response = await fetch('https://ankiuser.net/edit/getAddInfo', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.error(`HTTP error fetching add info! status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn(`Expected JSON response but got ${contentType}`);
                // 尝试解析文本响应
                const text = await response.text();
                console.log('Response text preview:', text.substring(0, 200) + '...');
                
                // 尝试从文本中提取 JSON
                try {
                    const jsonMatch = /(\{.*\})/s.exec(text);
                    if (jsonMatch) {
                        const jsonText = jsonMatch[1];
                        console.log('Extracted JSON text:', jsonText.substring(0, 200) + '...');
                        return JSON.parse(jsonText);
                    }
                } catch (jsonError) {
                    console.error('Error parsing extracted JSON:', jsonError);
                }
                
                throw new Error('Response is not JSON');
            }
            
            const data = await response.json();
            console.log('Add info data received successfully');
            return data;
        } catch (error) {
            console.error('Error in getAddInfo:', error);
            return null;
        }
    }

    async getNotetypeFields(nid) {
        try {
            console.log(`Fetching notetype fields for ID ${nid}`);
            
            const response = await fetch(`https://ankiuser.net/edit/getNotetypeFields?ntid=${nid}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.error(`HTTP error fetching notetype fields! status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn(`Expected JSON response but got ${contentType}`);
                // 尝试解析文本响应
                const text = await response.text();
                console.log('Response text preview:', text.substring(0, 200) + '...');
                
                // 尝试从文本中提取 JSON
                try {
                    const jsonMatch = /(\{.*\})/s.exec(text);
                    if (jsonMatch) {
                        const jsonText = jsonMatch[1];
                        console.log('Extracted JSON text:', jsonText.substring(0, 200) + '...');
                        return JSON.parse(jsonText);
                    }
                } catch (jsonError) {
                    console.error('Error parsing extracted JSON:', jsonError);
                }
                
                throw new Error('Response is not JSON');
            }
            
            const data = await response.json();
            console.log(`Notetype fields for ID ${nid} received successfully`);
            return data;
        } catch (error) {
            console.error(`Error in getNotetypeFields for ID ${nid}:`, error);
            return null;
        }
    }

    async parseData(response) {
        try {
            console.log('Parsing data from response');
            
            // 提取 token
            let token = '';
            const tokenMatch = /anki\.Editor\('(.*)'/i.exec(response);
            if (tokenMatch) {
                token = tokenMatch[1];
                console.log('Found token using regex:', token);
            } else {
                // 尝试其他方式提取 token
                const altTokenMatch = /editor = new anki\.Editor\("([^"]+)"/i.exec(response);
                if (altTokenMatch) {
                    token = altTokenMatch[1];
                    console.log('Found token using alternative regex:', token);
                } else {
                    console.error('Failed to extract token. Response preview:', response.substring(0, 500) + '...');
                    throw new Error('Failed to extract token');
                }
            }
            
            console.log('Fetching add info...');
            const Addinfo = await this.getAddInfo();
            
            if (!Addinfo) {
                console.error('Failed to get add info');
                throw new Error('Failed to get add info');
            }
            
            console.log('Add info received:', JSON.stringify(Addinfo).substring(0, 200) + '...');

            let decknames = [];
            let deckids = {};
            let modelnames = [];
            let modelids = {};
            let modelfieldnames = {};

            // 处理牌组信息
            if (Array.isArray(Addinfo.decks)) {
                console.log(`Processing ${Addinfo.decks.length} decks`);
                for (const deck of Addinfo.decks) {
                    if (deck && deck.name && deck.id) {
                        decknames.push(deck.name);
                        deckids[deck.name] = deck.id;
                    }
                }
            } else {
                console.warn('Decks information is not an array or is missing');
            }

            // 处理模型信息
            if (Array.isArray(Addinfo.notetypes)) {
                console.log(`Processing ${Addinfo.notetypes.length} notetypes`);
                for (const notetype of Addinfo.notetypes) {
                    if (notetype && notetype.name && notetype.id) {
                        modelnames.push(notetype.name);
                        modelids[notetype.name] = notetype.id;

                        try {
                            console.log(`Fetching fields for notetype ${notetype.name} (ID: ${notetype.id})`);
                            const NotetypeFields = await this.getNotetypeFields(notetype.id);
                            
                            if (!NotetypeFields) {
                                console.warn(`No fields returned for notetype ${notetype.name}`);
                                continue;
                            }
                            
                            if (!Array.isArray(NotetypeFields.fields)) {
                                console.warn(`Fields for notetype ${notetype.name} is not an array`);
                                continue;
                            }
                            
                            let fieldnames = [];
                            for (const field of NotetypeFields.fields) {
                                if (field && field.name) {
                                    fieldnames.push(field.name);
                                }
                            }
                            
                            if (fieldnames.length > 0) {
                                modelfieldnames[notetype.name] = fieldnames;
                                console.log(`Added ${fieldnames.length} fields for notetype ${notetype.name}`);
                            } else {
                                console.warn(`No valid fields found for notetype ${notetype.name}`);
                            }
                        } catch (error) {
                            console.error(`Error processing notetype ${notetype.name}:`, error);
                        }
                    }
                }
            } else {
                console.warn('Notetypes information is not an array or is missing');
            }

            // 验证结果
            if (decknames.length === 0) {
                console.warn('No decks found');
            }
            
            if (modelnames.length === 0) {
                console.warn('No models found');
            }
            
            const result = {
                token,
                decknames,
                deckids,
                modelnames,
                modelids,
                modelfieldnames
            };
            
            console.log('Parse data completed successfully');
            return result;
        } catch (error) {
            console.error('Error in parseData:', error);
            return null;
        }
    }
}

// 为 Service Worker 环境导出类
if (typeof self !== 'undefined') {
    self.Ankiweb = Ankiweb;
}