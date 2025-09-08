(function () {
    'use strict';

    // 防止重复定义
    if (window.PhoneUI) return;

    const PhoneUI = {
        DOMElements: {},
        observer: null,
        islandTimeout: null,

        // State variables
        commandQueue: [],
        viewHistory: [],
        state: {},
        currentChat: null,
        STICKERS: {},
        weatherData: { city: "未设置", temp: 0, condition: "未知", hi: 0, lo: 0, conditionClass: '' },

        // Constants
        STORAGE_KEY_STATE: 'st_phone_ui_v19_state',
        STORAGE_KEY_MESSAGES: 'st_phone_ui_v19_user_messages',
        WEATHER_MAPPING: { '晴':{class:'sunny',icon:'fas fa-sun',img:'https://files.catbox.moe/3sotss.jpeg'}, '夜':{class:'clear-night',icon:'fas fa-moon',img:'https://files.catbox.moe/71xfld.jpeg'}, '日落':{class:'sunset',icon:'fas fa-cloud-sun',img:'https://files.catbox.moe/6i3tfo.jpeg'}, '多云':{class:'cloudy',icon:'fas fa-cloud',img:'https://files.catbox.moe/rijvtl.jpeg'}, '阴':{class:'cloudy',icon:'fas fa-cloud',img:'https://files.catbox.moe/rijvtl.jpeg'}, '小雨':{class:'rainy',icon:'fas fa-cloud-showers-heavy',img:'https://files.catbox.moe/oc32cc.jpeg'}, '中雨':{class:'rainy',icon:'fas fa-cloud-showers-heavy',img:'https://files.catbox.moe/oc32cc.jpeg'}, '大雨':{class:'heavy-rain',icon:'fas fa-bolt',img:'https://files.catbox.moe/7y2hhz.jpeg'}, '暴雨':{class:'heavy-rain',icon:'fas fa-bolt',img:'https://files.catbox.moe/7y2hhz.jpeg'}, '雷雨':{class:'thunderstorm',icon:'fas fa-bolt',img:'https://files.catbox.moe/cqibuw.jpeg'}, '下雪':{class:'snowy',icon:'fas fa-snowflake',img:'https://files.catbox.moe/fsnqoy.jpeg'}, '雪':{class:'snowy',icon:'fas fa-snowflake',img:'https://files.catbox.moe/fsnqoy.jpeg'}},
        WEATHER_TRANSITIONS: ['晴', '多云', '阴', '小雨', '晴'],
        PLUS_FEATURES: [ { label: '相册', icon: 'fa-images', action: () => { const d = prompt('图片描述:'); if (d) { this.sendUserMessage(`[图片: {"type":"desc","value":"${d}"}]`); this.togglePanel(null); } } }, { label: '拍摄', icon: 'fa-camera', action: () => alert('功能开发中') }, { label: '视频通话', icon: 'fa-video', action: () => alert('功能开发中') }, { label: '位置', icon: 'fa-map-marker-alt', action: () => { const l=prompt('输入位置:'); if (l) { this.sendUserMessage(`[位置: ${l}]`); this.togglePanel(null); } } }, { label: '红包', icon: 'fa-wallet', action: () => { const a = prompt('红包金额 (最高200):'); if (a) { const amount = parseFloat(a); if (isNaN(amount) || amount <= 0) { alert('请输入有效金额。'); return; } if (amount > 200) { alert('单个红包金额不能超过200。'); return; } const b = prompt('祝福语 (可不填):', '恭喜发财，大吉大利！'); this.sendUserMessage(`[红包: {"blessing": "${b}", "status": "pending"}]`); this.togglePanel(null); } } }, { label: '转账', icon: 'fa-exchange-alt', action: () => { const a = prompt('转账金额:'); if (a) { const amount = parseFloat(a); if (isNaN(amount) || amount <= 0) { alert('请输入有效金额。'); return; } const r = prompt('转账说明 (可不填):'); this.sendUserMessage(`[转账: {"amount": "${amount.toFixed(2)}", "remark": "${r}", "status": "pending"}]`); this.togglePanel(null); } } }, { label: '文件', icon: 'fa-file-alt', action: () => { const n = prompt('文件名:'); if(n) { const s = prompt('文件大小 (例如: 2.5MB):', '1MB'); this.sendUserMessage(`[文件: {"name": "${n}", "size": "${s}"}]`); this.togglePanel(null); } } }, { label: '礼物', icon: 'fa-gift', action: () => { const n = prompt('礼物名称:'); if(n) { this.sendUserMessage(`[礼物: {"name": "${n}", "status": "pending"}]`); this.togglePanel(null); }} } ],

        init() {
            // A flag to prevent multiple initializations
            if (window.isPhoneUiInitialized) {
                console.log("Phone UI already initialized. Halting redundant execution.");
                return;
            }
            window.isPhoneUiInitialized = true;

            try {
                this.cacheDOMElements();
                this.initializeState();

                // Expose necessary functions to the global scope for inline handlers
                window.handleInteractiveBubbleClick = this.handleInteractiveBubbleClick.bind(this);

                // Initialize sub-modules
                if (window.BoliCampusCardApp) window.BoliCampusCardApp.init();
                if (window.BoliBiteApp) window.BoliBiteApp.init();

                this.fullRender();
                this.setupEventListeners();

                this.goHome();
                this.updateCommandQueueUI();

                // Setup observer for live updates
                this.observer = new MutationObserver(() => this.processNewData());
                this.observer.observe(this.DOMElements.sourceData, { childList: true, characterData: true, subtree: true });
                this.processNewData(); // Initial data processing

            } catch (e) {
                console.error('Phone UI Script Error:', e);
                document.body.innerHTML = `<div style="padding:20px;background:#c0392b;color:white;font-family:monospace;white-space:pre-wrap;border-radius:10px;"><h3>Phone UI 脚本错误</h3>此错误可能是由于本地数据与新版脚本不兼容导致。请尝试 <button onclick="localStorage.clear();location.reload();" style="padding:5px 10px; border:none;border-radius:5px;cursor:pointer;">点击此处清除数据并刷新</button><hr style="margin:10px 0; border-color:rgba(255,255,255,0.3);"><b>错误信息:</b> ${e.message}<b>Stack:</b>${e.stack}</div>`;
            }
        },

        cleanup() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.islandTimeout) {
                clearTimeout(this.islandTimeout);
            }
            // Remove global functions
            delete window.handleInteractiveBubbleClick;
            window.isPhoneUiInitialized = false;
            console.log("Phone UI Unloaded and Cleaned Up.");
        },

        cacheDOMElements() {
            this.DOMElements = { phone: document.querySelector('.phone-container'), sourceData: document.getElementById('phone-data-source'), dynamicIsland: document.getElementById('dynamic-island'), homeScreen: document.getElementById('home-screen'), wechatApp: document.getElementById('wechat-app'), wechatTitle: document.getElementById('wechat-title'), chatsView: document.getElementById('wechat-chats-view'), contactsView: document.getElementById('wechat-contacts-view'), myProfileCard: document.getElementById('my-profile-card'), chatWindow: document.getElementById('chat-window-view'), chatWindowTitle: document.getElementById('chat-window-title'), chatInfoView: document.getElementById('chat-info-view'), chatInfoTitle: document.getElementById('chat-info-title'), chatInfoContent: document.getElementById('chat-info-content'), chatOptionsBtn: document.getElementById('chat-options-btn'), messagesContainer: document.querySelector('#chat-window-view .messages-container'), chatInput: document.getElementById('chat-input-textarea'), sendBtn: document.getElementById('chat-send-btn'), emojiBtn: document.getElementById('chat-emoji-btn'), plusBtn: document.getElementById('chat-plus-btn'), panelContainer: document.getElementById('panel-container'), emojiMenu: document.getElementById('chat-emoji-menu'), plusMenu: document.getElementById('chat-plus-menu'), momentsView: document.getElementById('moments-view'), momentsHeaderBg: document.querySelector('#moments-view .moments-header-bg'), myMomentsName: document.getElementById('my-moments-name'), myMomentsAvatar: document.getElementById('my-moments-avatar'), myMomentsSignature: document.getElementById('my-moments-signature'), momentsFeed: document.getElementById('moments-feed-container'), postMomentBtn: document.getElementById('post-new-moment'), friendRequestsContainer: document.getElementById('friend-requests-list-container'), cqContainer: document.getElementById('cq-container'), cqFab: document.getElementById('cq-fab'), cqBadge: document.getElementById('cq-badge'), cqList: document.getElementById('cq-list'), cqSendBtn: document.getElementById('cq-send-btn'), cqClearBtn: document.getElementById('cq-clear-btn'), weatherAppView: document.getElementById('weather-app-view') };
        },

        initializeState() {
            const hasLocalData = this.loadState();
            if (!hasLocalData || !this.state.config) {
                this.state = { config: {}, chatList: [], chatLogs: {}, momentsLog: [], contacts: [], contactMap: {}, friendRequests: [], handledRequestIds: [], avatarOverrides: {}, lastProcessedSource: null };
            }
            ['chatList', 'momentsLog', 'contacts', 'friendRequests', 'handledRequestIds'].forEach(key => { if (!this.state[key] || !Array.isArray(this.state[key])) this.state[key] = []; });
            ['chatLogs', 'contactMap', 'avatarOverrides'].forEach(key => { if (!this.state[key] || typeof this.state[key] !== 'object' || this.state[key] === null) this.state[key] = {}; });
        },

        // ---------- AI Communication and Data Processing ----------
        sendCommandToAI(cmd) { typeof triggerSlash === 'function' ? triggerSlash(`/send ${cmd}|/trigger`) : (console.log(`[SIMULATED]: /send ${cmd}|/trigger`), alert(`模拟发送:\n/send ${cmd}|/trigger`)); },
        queueCommand(cmd) { this.commandQueue.push(cmd); this.updateCommandQueueUI(); },

        processNewData() {
            let sourceContent = this.DOMElements.sourceData.textContent;
            const weatherRegex = /\[天气更新: (.*?), (-?\d+), (.*?), (-?\d+)\/(-?\d+)\]\n?/g;
            let weatherMatch;
            while ((weatherMatch = weatherRegex.exec(sourceContent)) !== null) {
                const newData = { city: weatherMatch[1].trim(), temp: parseInt(weatherMatch[2], 10), condition: weatherMatch[3].trim(), hi: parseInt(weatherMatch[4], 10), lo: parseInt(weatherMatch[5], 10) };
                this.updateWeatherUI(newData);
                this.DOMElements.sourceData.textContent = this.DOMElements.sourceData.textContent.replace(weatherMatch[0], '');
            }
            sourceContent = this.DOMElements.sourceData.textContent.trim();
            if (!sourceContent || sourceContent === this.state.lastProcessedSource) {
                return;
            }
            const newData = this.parseSourceData(sourceContent);
            if (newData.campusCard && Object.keys(newData.campusCard).length > 0 && window.BoliCampusCardApp) {
                Object.assign(window.BoliCampusCardApp.state, newData.campusCard);
                window.BoliCampusCardApp.saveState();
                window.BoliCampusCardApp.render();
            }
            Object.assign(this.state.config, newData.config);
            newData.chatListUpdates.forEach(updatedChat => {
                let existingChat = this.state.chatList.find(c => c.id === updatedChat.id);
                if (existingChat) {
                    if (updatedChat.type === 'group') {
                        if (!updatedChat.hasOwnProperty('members') && existingChat.members) updatedChat.members = existingChat.members;
                        if (!updatedChat.hasOwnProperty('admins') && existingChat.admins) updatedChat.admins = existingChat.admins;
                    }
                    Object.assign(existingChat, updatedChat);
                } else {
                    const isAIStandardId = !updatedChat.id.includes('_local_');
                    const localChatMatch = isAIStandardId ? this.state.chatList.find(c => c.id.includes('_local_') && c.name.replace(/\s*\(\d+\)$/, '') === updatedChat.name.replace(/\s*\(\d+\)$/, '')) : null;
                    if (localChatMatch) {
                        const oldId = localChatMatch.id;
                        const newId = updatedChat.id;
                        const allOldLogs = [...(this.state.chatLogs[oldId] || []), ...this.getUserMessagesFromStorage(oldId)];
                        if (!this.state.chatLogs[newId]) this.state.chatLogs[newId] = [];
                        this.state.chatLogs[newId].push(...allOldLogs, ...(newData.chatLogs[newId] || []));
                        delete this.state.chatLogs[oldId];
                        this.clearUserMessagesFromStorage(oldId);
                        const contactToUpdate = this.state.contacts.find(c => c.id === oldId);
                        if (contactToUpdate) contactToUpdate.id = newId;
                        Object.values(this.state.chatLogs).forEach(log => { log.forEach(msg => { if (msg.chatId === oldId) msg.chatId = newId; }); });
                        if (this.state.avatarOverrides[oldId]) { this.state.avatarOverrides[newId] = this.state.avatarOverrides[oldId]; delete this.state.avatarOverrides[oldId]; }
                        Object.assign(localChatMatch, updatedChat);
                        existingChat = localChatMatch;
                    } else {
                        this.state.chatList.unshift(updatedChat);
                        existingChat = updatedChat;
                    }
                }
                if (existingChat && this.state.avatarOverrides[existingChat.id]) { existingChat.avatar = this.state.avatarOverrides[existingChat.id]; }
            });
            for (const id in newData.chatLogs) {
                if (!this.state.chatLogs[id]) this.state.chatLogs[id] = [];
                const existingTimestamps = new Set(this.state.chatLogs[id].map(m => m.timestamp));
                const uniqueNewMessages = newData.chatLogs[id].filter(m => !existingTimestamps.has(m.timestamp));
                if (uniqueNewMessages.length > 0) this.state.chatLogs[id].push(...uniqueNewMessages);
            }
            this.state.momentsLog.push(...newData.momentsLog);
            newData.contacts.forEach(c => { if (!this.state.contacts.some(ec => ec.name === c.name)) this.state.contacts.push(c); });
            if (newData.friendRequests.length > 0) {
                this.state.friendRequests.push(...newData.friendRequests);
                this.showIslandNotification('<i class="fas fa-user-plus"></i>', '收到新的好友申请');
            }
            this.state.contactMap = {};
            this.state.contacts.forEach(c => this.state.contactMap[c.name] = c);
            this.state.lastProcessedSource = sourceContent;
            this.saveState();
            this.fullRender();
            if (this.DOMElements.chatWindow.classList.contains('active') && this.currentChat) {
                const chatStillExists = this.state.chatList.find(c => c.id === this.currentChat.id);
                if (chatStillExists) this.renderChatWindow(this.currentChat.id);
                else this.navigateTo('wechat-app');
            }
        },

        parseSourceData(dataString) {
            const newData = { config: {}, chatListUpdates: [], chatLogs: {}, momentsLog: [], contacts: [], friendRequests: [], campusCard: null };
            let lines = dataString.split('\n').map(l => l.trim()).filter(Boolean);
            let currentSection = 'CONFIG', currentChatLogId = null;
            lines.forEach(line => {
                if (line.startsWith('[') && line.endsWith(']')) {
                    const tag = line.slice(1, -1);
                    const knownSections = { 'CHAT_LIST': 'CHAT_LIST', 'MOMENTS_LOG': 'MOMENTS_LOG', 'CONTACTS': 'CONTACTS', 'FRIEND_REQUESTS': 'FRIEND_REQUESTS', 'CONFIG': 'CONFIG', 'CAMPUS_CARD': 'CAMPUS_CARD' };
                    if (tag.startsWith('CHAT_LOG:')) {
                        currentSection = 'CHAT_LOG';
                        currentChatLogId = tag.substring(9);
                        if (!newData.chatLogs[currentChatLogId]) newData.chatLogs[currentChatLogId] = [];
                    } else if (knownSections[tag]) {
                        currentSection = knownSections[tag];
                        if (currentSection === 'CAMPUS_CARD') newData.campusCard = {};
                    } else {
                        currentSection = 'UNKNOWN';
                    }
                    return;
                }
                let match;
                switch (currentSection) {
                    case 'CONFIG': if (match = line.match(/^([^:]+):\s*(.*)$/)) newData.config[match[1]] = match[2]; break;
                    case 'CHAT_LIST': if (match = line.match(/^CHAT:\s*(.*)$/)) try { newData.chatListUpdates.push(JSON.parse(match[1])); } catch (e) { } break;
                    case 'CHAT_LOG': if (!currentChatLogId) return; const timestamp = Date.now() + Math.random(); if (match = line.match(/^TIME:\s*(.*)$/)) { try { if (JSON.parse(match[1])) newData.chatLogs[currentChatLogId].push({ type: 'TIME', sender: null, content: match[1], timestamp }); } catch (e) { } } else if (match = line.match(/^SYSTEM:\s*(.*)$/)) { newData.chatLogs[currentChatLogId].push({ type: 'SYSTEM', sender: null, content: match[1], timestamp }); } else if (match = line.match(/^([^:]+):\s*(.*)$/)) { const [, senderKey, content] = match; const senderName = senderKey.startsWith('CHAR-') ? senderKey.substring(5) : (senderKey === 'CHAR' ? null : senderKey); newData.chatLogs[currentChatLogId].push({ type: 'CHAR', sender: senderName, content: content, timestamp }); } break;
                    case 'MOMENTS_LOG': if (match = line.match(/^MOMENT:\s*(.*)$/)) try { const moment = JSON.parse(match[1]); if (!this.state.momentsLog.some(m => m.id === moment.id)) newData.momentsLog.push(moment); } catch (e) { } break;
                    case 'CONTACTS': if (match = line.match(/^CONTACT:\s*(.*)$/)) { try { const c = JSON.parse(match[1]); if (!this.state.contacts.some(ct => ct.name === c.name)) newData.contacts.push(c); } catch (e) { } } break;
                    case 'FRIEND_REQUESTS': if (match = line.match(/^REQUEST:\s*(.*)$/)) try { const req = JSON.parse(match[1]); if (!this.state.friendRequests.some(r => r.id === req.id) && !this.state.handledRequestIds.includes(req.id)) newData.friendRequests.push(req); } catch (e) { } break;
                    case 'CAMPUS_CARD': if (newData.campusCard && (match = line.match(/^([^:]+):\s*(.*)$/))) { const key = match[1].toLowerCase(); const value = match[2]; if (key === 'balance') { newData.campusCard[key] = parseFloat(value) || 0; } else { newData.campusCard[key] = value; } } break;
                }
            });
            return newData;
        },

        // ---------- State & Storage Management ----------
        saveState() {
            try {
                const fullState = {
                    state: this.state,
                    STICKERS: this.STICKERS,
                    weatherData: this.weatherData,
                    boliBiteState: window.BoliBiteApp ? window.BoliBiteApp.state : undefined,
                };
                localStorage.setItem(this.STORAGE_KEY_STATE, JSON.stringify(fullState));
            } catch (e) { console.error("Error saving state to localStorage:", e); }
        },

        loadState() {
            try {
                const d = localStorage.getItem(this.STORAGE_KEY_STATE);
                if (d) {
                    const data = JSON.parse(d);
                    if (data.state?.config) {
                        this.state = data.state;
                        this.STICKERS = data.STICKERS || {};
                        if (data.weatherData) this.updateWeatherUI(data.weatherData);
                        if (data.boliBiteState && window.BoliBiteApp) window.BoliBiteApp.state = { ...window.BoliBiteApp.state, ...data.boliBiteState };
                    }
                    return true;
                }
            } catch (e) { console.error("Error loading state from localStorage:", e); }
            return false;
        },

        getUserMessagesFromStorage(chatId) { try { const all = JSON.parse(localStorage.getItem(this.STORAGE_KEY_MESSAGES) || '{}'); return all[chatId] || []; } catch (e) { return []; } },
        saveUserMessageToStorage(chatId, msg) { try { const all = JSON.parse(localStorage.getItem(this.STORAGE_KEY_MESSAGES) || '{}'); if (!all[chatId]) all[chatId] = []; all[chatId].push(msg); localStorage.setItem(this.STORAGE_KEY_MESSAGES, JSON.stringify(all)); } catch (e) { } },
        saveUserMessages(chatId, messages) { try { const all = JSON.parse(localStorage.getItem(this.STORAGE_KEY_MESSAGES) || '{}'); all[chatId] = messages; localStorage.setItem(this.STORAGE_KEY_MESSAGES, JSON.stringify(all)); } catch (e) { } },
        clearUserMessagesFromStorage(chatId) { try { const all = JSON.parse(localStorage.getItem(this.STORAGE_KEY_MESSAGES) || '{}'); delete all[chatId]; localStorage.setItem(this.STORAGE_KEY_MESSAGES, JSON.stringify(all)); } catch (e) { } },

        // ---------- Navigation ----------
        navigateTo(targetId, data = {}) {
            const cView = this.DOMElements.phone.querySelector('.phone-view.active'), tView = document.getElementById(targetId);
            if (!tView || (cView && cView.id === targetId)) return;
            this.viewHistory.push({ id: cView.id, data: { ...this.currentChat } });
            cView.classList.remove('active');
            cView.classList.add('inactive-left');
            tView.classList.remove('inactive-left', 'inactive-right');
            tView.classList.add('active');
            if (targetId === 'chat-window-view') {
                const chatToClear = this.state.chatList.find(c => c.id === data.chatId);
                if (chatToClear && chatToClear.unread > 0) { chatToClear.unread = 0; this.saveState(); this.renderChatList(); }
                this.currentChat = this.state.chatList.find(c => c.id === data.chatId);
                this.DOMElements.chatWindowTitle.textContent = this.currentChat.name;
                this.renderChatWindow(data.chatId);
            } else if (targetId === 'chat-info-view') {
                this.renderChatInfoView();
            }
        },

        navigateBack() {
            const cView = this.DOMElements.phone.querySelector('.phone-view.active');
            if (!cView) return;
            const pViewInfo = this.viewHistory.pop();
            if (!pViewInfo) { this.goHome(); return; }
            cView.classList.remove('active');
            cView.classList.add('inactive-right');
            const prevView = document.getElementById(pViewInfo.id);
            prevView?.classList.remove('inactive-left', 'inactive-right');
            prevView?.classList.add('active');
            if (pViewInfo.id === 'chat-window-view') { this.currentChat = pViewInfo.data; this.DOMElements.chatWindowTitle.textContent = this.currentChat?.name || ''; }
            else if (pViewInfo.id === 'home-screen') { this.currentChat = null; }
            else if (pViewInfo.id === 'wechat-app' && pViewInfo.data.id && pViewInfo.data.id.startsWith('chat_')) { this.currentChat = null; this.renderChatList(); }
            else { this.currentChat = null; }
        },

        goHome() {
            this.viewHistory.length = 0;
            this.DOMElements.phone.querySelectorAll('.phone-view').forEach(v => {
                v.classList.remove('active', 'inactive-left', 'inactive-right');
                if (v.id !== 'home-screen') v.classList.add('inactive-right');
            });
            this.DOMElements.homeScreen.classList.add('active');
            this.currentChat = null;
        },

        // ---------- UI Rendering ----------
        fullRender() {
            if(!this.DOMElements.homeScreen) return;
            this.DOMElements.homeScreen.style.backgroundImage = `url('${this.state.config.home_wallpaper}')`;
            this.DOMElements.chatWindow.style.backgroundImage = `url('${this.state.config.chat_wallpaper}')`;
            this.DOMElements.momentsHeaderBg.style.backgroundImage = `url('${this.state.config.moments_cover}')`;
            const wechatIcon = document.querySelector('.app-icon[data-app="wechat-app"] .icon-bg');
            if(wechatIcon) wechatIcon.innerHTML = `<i class="fab fa-weixin"></i>`;
            this.renderChatList();
            this.renderContacts();
            this.renderMyProfile();
            this.renderMoments();
            this.renderEmojiMenu();
            this.renderPlusMenu();
            this.renderFriendRequestsView();
            if (this.weatherData.city !== "未设置") this.updateWeatherUI(this.weatherData);
            if(window.BoliBiteApp && window.BoliBiteApp.updateCartBadge) window.BoliBiteApp.updateCartBadge();
            if(window.BoliCampusCardApp && window.BoliCampusCardApp.render) window.BoliCampusCardApp.render();
        },

        renderChatList() {
            const sortedChats = this.state.chatList.sort((a, b) => (new Date(b.time) || 0) - (new Date(a.time) || 0));
            this.DOMElements.chatsView.innerHTML = sortedChats.map(c => {
                const cleanMsg = (c.latest_msg || '').replace(/^CHAR(-[^:]+)?: /, '').replace(/\[有人@我\]/g, '<b>[有人@我]</b>').replace(/\[草稿\]/g, '<b>[草稿]</b>').replace(/\[转账:\s*\{.*\}\]/g, '[转账]').replace(/\[红包:\s*\{.*\}\]/g, '[红包]').replace(/\[礼物:\s*\{.*\}\]/g, '[礼物]').replace(/\[文件:\s*\{.*\}\]/g, '[文件]').replace(/\[位置:\s*.*\]/g, '[位置]');
                const avatar = this.state.avatarOverrides[c.id] || c.avatar;
                return `<div class="chat-list-item" data-chat-id="${c.id}"><div class="chat-avatar" style="background-image: url('${avatar}');">${c.unread > 0 ? `<div class="unread-badge">${c.unread}</div>` : ''}</div><div class="chat-info"><div class="chat-info-header"><div class="chat-name">${c.name}</div><div class="chat-time">${c.time || ''}</div></div><div class="last-message">${cleanMsg}</div></div></div>`;
            }).join('');
        },

        renderContacts() {
            let html = `<div id="new-friend-btn" class="menu-item"><i class="fas fa-user-plus" style="color:#f0a238;"></i><span class="menu-label">新的朋友</span><div class="red-dot"></div></div><div id="group-chat-btn" class="menu-item"><i class="fas fa-users" style="color:#07c160;"></i><span class="menu-label">群聊</span></div>`;
            const sortedContacts = [...this.state.contacts].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN-pinyin'));
            const getGroupKey = (name) => { const firstChar = name.charAt(0).toUpperCase(); if (firstChar >= 'A' && firstChar <= 'Z') return firstChar; return '#'; };
            let lastGroupKey = ''; sortedContacts.forEach(contact => { if (!contact.name) return; const groupKey = getGroupKey(contact.name); if (groupKey !== lastGroupKey) { html += `<div class="contacts-group-title">${groupKey}</div>`; lastGroupKey = groupKey; } const avatar = this.state.avatarOverrides[contact.id] || contact.avatar; html += `<div class="contact-item" data-contact-id="${contact.id}"><div class="contact-avatar" style="background-image: url('${avatar}')"></div><span>${contact.name}</span></div>`; });
            this.DOMElements.contactsView.innerHTML = html;
            this.DOMElements.contactsView.querySelector('.red-dot').style.display = this.state.friendRequests.length > 0 ? 'block' : 'none';
        },

        renderMyProfile() { this.DOMElements.myProfileCard.innerHTML = `<div class="profile-card"><div class="profile-avatar" style="background-image:url('${this.state.config.user_avatar}');"></div><div class="profile-info"><div class="profile-name">${this.state.config.user_name}</div><div class="profile-id">微信号：w-user-id-123</div></div></div>`; },

        renderMoments() {
            this.DOMElements.myMomentsName.textContent = this.state.config.user_name;
            this.DOMElements.myMomentsAvatar.style.backgroundImage = `url('${this.state.config.user_avatar}')`;
            this.DOMElements.myMomentsSignature.textContent = this.state.config.moments_signature;
            this.DOMElements.momentsFeed.innerHTML = (this.state.momentsLog || []).toReversed().map(m => this.createMomentHTML(m)).join('');
        },

        createMomentHTML(m) {
            const contact = this.state.contactMap[m.author]; const authorId = contact ? contact.id : null; const avatar = (authorId ? this.state.avatarOverrides[authorId] : null) || m.avatar; const iLiked = m.likes?.includes(this.state.config.user_name); const isMyMoment = m.author === this.state.config.user_name;
            return `<div class="moment-item" data-moment-id="${m.id}"><div class="moment-avatar" style="background-image:url('${avatar}')"></div><div class="moment-body"><div class="author">${m.author}</div><div class="content-text">${m.text}</div>${m.images?.length ? `<div class="moment-images">${m.images.map(img => `<div class="moment-image" style="background-image:url('${img}')"></div>`).join('')}</div>` : ''}<div class="moment-meta"><span>${m.time}</span><div class="moment-actions-btn" title="操作"><i class="fas fa-ellipsis-h"></i></div></div><div class="moment-actions-popup"><a href="#" class="action-like">${iLiked ? '<i class="fas fa-heart"></i> 取消' : '<i class="far fa-heart"></i> 赞'}</a><div class="divider"></div><a href="#" class="action-comment"><i class="far fa-comment"></i> 评论</a>${isMyMoment ? '<div class="divider"></div><a href="#" class="action-delete">删除</a>' : ''}</div>${(m.likes?.length || m.comments?.length) ? `<div class="moment-social">${m.likes?.length ? `<div class="moment-likes"><i class="fas fa-heart"></i> ${m.likes.join(', ')}</div>` : ''}${m.comments?.length ? `<div class="moment-comments">${m.comments.map(c => `<div class="moment-comment"><b>${c.author}</b>: ${c.text}</div>`).join('')}</div>` : ''}</div>` : ''}</div></div>`;
        },

        renderChatWindow(chatId, optimisticMessage = null) {
            this.DOMElements.messagesContainer.innerHTML = '';
            const allMessages = [...(this.state.chatLogs[chatId] || []), ...this.getUserMessagesFromStorage(chatId)];
            if (optimisticMessage && !allMessages.some(m => m.timestamp === optimisticMessage.timestamp)) { allMessages.push(optimisticMessage); }
            allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            this.DOMElements.messagesContainer.innerHTML = allMessages.map(msg => this.createMessageHTML(msg)).join('');
            const chatArea = this.DOMElements.chatWindow.querySelector('.chat-content-area');
            setTimeout(() => chatArea.scrollTop = chatArea.scrollHeight, 50);
            this.updateInputBar();
        },

        createMessageHTML(msg) {
            if (msg.type === 'TIME') { try { const data = JSON.parse(msg.content); if (data.status && this.currentChat.type === 'private') { return `<div class="timestamp-row interactive-timestamp"><details><summary><span class="timestamp-text">${data.time}</span></summary><div class="status-text">${data.status}</div></details></div>`; } else { return `<div class="timestamp-row"><span class="timestamp-text">${data.time}</span></div>`; } } catch (e) { return ''; } }
            if (msg.type === 'SYSTEM') { return `<div class="system-message-row"><span class="system-message-text">${msg.content}</span></div>`; }
            const isSent = msg.type === 'USER';
            const finalSenderName = isSent ? this.state.config.user_name : (msg.sender === null ? this.currentChat.name : msg.sender);
            const parsedContent = this.parseMessageContent(msg.content, isSent);
            const isDeletable = !parsedContent.isInteractive && msg.type !== 'SYSTEM' && msg.type !== 'TIME';
            let avatarUrl = isSent ? this.state.config.user_avatar : (this.state.avatarOverrides[this.currentChat.id] || this.currentChat.avatar);
            let senderNameToDisplay = null;
            if (!isSent) { const contact = this.state.contacts.find(c => c.name === finalSenderName); if (contact) { avatarUrl = this.state.avatarOverrides[contact.id] || contact.avatar; } if (this.currentChat.type === 'group' && finalSenderName !== this.currentChat.name.replace(/\s*\(\d+\)$/, '')) { senderNameToDisplay = finalSenderName; } }
            let bubbleContentHtml = parsedContent.html;
            if (parsedContent.isInteractive) { bubbleContentHtml = `<div data-type="${parsedContent.type}" data-content='${JSON.stringify(parsedContent.data)}'>${parsedContent.html}</div>`; }
            return `<div class="message-row ${isSent ? 'msg-sent' : 'msg-received'} ${isDeletable ? 'deletable' : ''}" data-timestamp="${msg.timestamp}"><div class="chat-win-avatar" style="background-image: url('${avatarUrl}')"></div><div class="message-content">${senderNameToDisplay ? `<div class="msg-sender-name">${senderNameToDisplay}</div>` : ''}<div class="message-bubble ${parsedContent.bubbleClass}">${bubbleContentHtml}</div></div></div>`;
        },

        renderFriendRequestsView() {
            let html = '<div id="manual-add-friend-topbar"><i class="fas fa-user-plus"></i>  手动添加好友</div>';
            if (this.state.friendRequests.length === 0) { html += `<div style="text-align:center; color: #888; padding: 40px 20px;">没有新的好友申请</div>`; } else { html += this.state.friendRequests.map(req => `<div class="friend-request-item" data-request-id="${req.id}"><div class="chat-avatar" style="background-image: url('${req.avatar}');"></div><div class="friend-info"><div class="name">${req.name}</div><div class="message">${req.message}</div></div><div class="actions"><button class="accept-btn" data-action="accept">接受</button></div></div>`).join(''); }
            this.DOMElements.friendRequestsContainer.innerHTML = html;
        },

        renderEmojiMenu() {
            let html = Object.entries(this.STICKERS).map(([name, url]) => ` <div class="sticker-item" data-name="${name}"> <div class="delete-sticker-btn" title="删除表情">×</div> <img src="${url}" class="sticker-preview" alt="${name}"> <span class="sticker-label">${name}</span> </div>`).join('');
            html += `<div class="sticker-item add-sticker-btn"><div class="icon-wrapper"><i class="fas fa-plus"></i></div><span>添加表情</span></div>`;
            this.DOMElements.emojiMenu.innerHTML = html;
        },

        renderPlusMenu() { this.DOMElements.plusMenu.innerHTML = this.PLUS_FEATURES.map(i => `<div class="plus-menu-item" data-action-label="${i.label}"><button class="icon-wrapper"><i class="fas ${i.icon}"></i></button><span>${i.label}</span></div>`).join(''); },

        renderChatInfoView() {
            if (!this.currentChat) return; const chat = this.currentChat; this.DOMElements.chatInfoTitle.textContent = chat.type === 'group' ? "聊天信息" : "设置"; let html = ''; if (chat.type === 'group') { const isAdmin = chat.admins && chat.admins.includes(this.state.config.user_name); const members = chat.members || []; const admins = chat.admins || []; const memberDisplayLimit = 20; const displayedMembers = members.slice(0, memberDisplayLimit); let memberGrid = '<div class="member-grid-container"><div class="member-grid">'; displayedMembers.forEach(name => { const contact = name === this.state.config.user_name ? { id: 'user', avatar: this.state.config.user_avatar } : this.state.contacts.find(c => c.name === name); const avatar = contact ? (this.state.avatarOverrides[contact.id] || contact.avatar) : 'https://i.pravatar.cc/150'; const isAdminBadge = admins.includes(name) ? `<div class="admin-badge"><i class="fas fa-star"></i></div>` : ''; memberGrid += `<div class="member-item"><div class="member-avatar" style="background-image: url('${avatar}')">${isAdminBadge}</div><div class="member-name">${name}</div></div>`; }); if (isAdmin) { memberGrid += `<div class="member-item"><div class="action-button" data-action="invite-member"><i class="fas fa-plus"></i></div></div>`; memberGrid += `<div class="member-item"><div class="action-button" data-action="remove-member"><i class="fas fa-minus"></i></div></div>`; } memberGrid += `</div></div>`; html += memberGrid; if (members.length > memberDisplayLimit) html += `<div class="show-all-members">查看全部群成员 (${members.length}) <i class="fas fa-chevron-right"></i></div>`; html += `<div class="section-spacer"></div>`; html += `<div class="info-menu-item" data-action="change-chat-name"><span class="label">群聊名称</span><span class="value">${chat.name.replace(/\s*\(\d+\)$/, '')}</span><i class="fas fa-chevron-right chevron"></i></div>`; html += `<div class="info-menu-item" data-action="change-chat-avatar"><span class="label">群头像</span><span class="value"></span><i class="fas fa-chevron-right chevron"></i></div>`; html += `<div class="section-spacer"></div>`; html += `<div class="info-menu-item" data-action="clear-chat-history"><span class="label">清空聊天记录</span><i class="fas fa-chevron-right chevron"></i></div>`; if (chat.is_public && !isAdmin) html += `<div class="info-menu-item" data-action="apply-admin"><span class="label">申请成为管理员</span><i class="fas fa-chevron-right chevron"></i></div>`; html += `<div class="section-spacer"></div><div class="action-menu-item danger" data-action="${isAdmin ? 'disband-group' : 'exit-group'}">${isAdmin ? '解散群聊' : '退出群聊'}</div>`; } else { html += `<div class="section-spacer" style="border-top: none;"></div>`; html += `<div class="info-menu-item" data-action="change-chat-name"><span class="label">备注和标签</span><span class="value">${chat.name}</span><i class="fas fa-chevron-right chevron"></i></div>`; html += `<div class="info-menu-item" data-action="change-chat-avatar"><span class="label">更换头像</span><i class="fas fa-chevron-right chevron"></i></div>`; html += `<div class="section-spacer"></div>`; html += `<div class="info-menu-item" data-action="clear-chat-history"><span class="label">清空聊天记录</span><i class="fas fa-chevron-right chevron"></i></div>`; html += `<div class="section-spacer"></div><div class="action-menu-item danger" data-action="delete-contact">删除联系人</div>`; }
            this.DOMElements.chatInfoContent.innerHTML = html;
        },

        updateWeatherUI(data) {
            this.weatherData = data;
            const mapping = this.WEATHER_MAPPING[data.condition] || { class: 'cloudy', icon: 'fas fa-question-circle', img: 'https://files.catbox.moe/rijvtl.jpeg' };
            this.weatherData.conditionClass = mapping.class;
            const widgetBg = document.getElementById('widget-bg-img'); if (widgetBg) { widgetBg.src = mapping.img; widgetBg.style.opacity = '1'; }
            const widgetCity = document.getElementById('widget-city'); if (widgetCity) widgetCity.textContent = data.city;
            const widgetTemp = document.getElementById('widget-temp'); if (widgetTemp) widgetTemp.textContent = `${data.temp}°`;
            const widgetCondition = document.getElementById('widget-condition'); if (widgetCondition) widgetCondition.textContent = data.condition;
            const widgetHiLo = document.getElementById('widget-hi-lo'); if (widgetHiLo) widgetHiLo.textContent = `最高:${data.hi}° 最低:${data.lo}°`;
            const appContainer = document.getElementById('weather-app-container'); if (appContainer) { appContainer.className = ''; appContainer.classList.add(this.weatherData.conditionClass); document.getElementById('app-city').textContent = data.city; document.getElementById('app-temp').textContent = `${data.temp}°`; document.getElementById('app-condition').textContent = data.condition; document.getElementById('app-hi-lo').textContent = `最高: ${data.hi}° 最低: ${data.lo}°`; this.generateHourlyForecast(data.temp, data.condition); this.generateDailyForecast(data.hi, data.lo); }
        },

        generateHourlyForecast(currentTemp, condition) { const container = document.getElementById('hourly-forecast-scroll'); if (!container) return; container.innerHTML = ''; let temp = currentTemp; let hourlyCondition = condition; const currentHour = new Date().getHours(); for (let i = 0; i < 24; i++) { const hourItem = document.createElement('div'); hourItem.className = 'hourly-item'; const time = i === 0 ? '现在' : `${(currentHour + i) % 24}时`; if (i > 0) { temp += (Math.random() - 0.5) * 2; } if (i > 0 && Math.random() < 0.25) { hourlyCondition = this.WEATHER_TRANSITIONS[Math.floor(Math.random() * this.WEATHER_TRANSITIONS.length)]; } const futureHour = (currentHour + i) % 24; const isDaytime = futureHour >= 6 && futureHour < 19; let mapping; if (hourlyCondition === '晴') { mapping = isDaytime ? this.WEATHER_MAPPING['晴'] : this.WEATHER_MAPPING['夜']; } else { mapping = this.WEATHER_MAPPING[hourlyCondition] || this.WEATHER_MAPPING['多云']; } hourItem.innerHTML = `<span>${time}</span><i class="${mapping.icon}"></i><span>${Math.round(temp)}°</span>`; container.appendChild(hourItem); } },
        generateDailyForecast(todayHi, todayLo) { const container = document.getElementById('daily-forecast-container'); if (!container) return; container.innerHTML = ''; const days = ['今天', '明天', '后天']; for (let i = 0; i < 10; i++) { const dayItem = document.createElement('div'); dayItem.className = 'daily-item'; let dayName; if (i < 3) { dayName = days[i]; } else { const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + i); dayName = `周${'日一二三四五六'[futureDate.getDay()]}`; } const hi = todayHi + Math.round((Math.random() - 0.45) * 6); const lo = todayLo + Math.round((Math.random() - 0.45) * 6); const avgTemp = (hi + lo) / 2; let possibleConditions; if (avgTemp <= 5) { possibleConditions = ['雪', '阴', '多云', '晴']; } else if (avgTemp > 28) { possibleConditions = ['晴', '雷雨', '多云']; } else { possibleConditions = ['晴', '多云', '阴', '小雨', '中雨']; } const randomCondition = possibleConditions[Math.floor(Math.random() * possibleConditions.length)]; const mapping = this.WEATHER_MAPPING[randomCondition]; dayItem.innerHTML = `<span>${dayName}</span><i class="${mapping.icon}"></i><span>${Math.max(hi,lo)}° / ${Math.min(hi,lo)}°</span>`; container.appendChild(dayItem); } },

        showIslandNotification(iconHtml, text) { clearTimeout(this.islandTimeout); const island = this.DOMElements.dynamicIsland; island.querySelector('.island-content').innerHTML = `${iconHtml}<span>${text}</span>`; island.classList.add('expanded'); this.islandTimeout = setTimeout(() => island.classList.remove('expanded'), 2500); },

        updateCommandQueueUI() { this.DOMElements.cqList.innerHTML = this.commandQueue.map(cmd => `<li class="cq-list-item">${cmd.replace(/\n/g, ' ')}</li>`).join('') || '<li class="cq-list-item" style="border:none;text-align:center;color:#888;">暂无指令</li>'; this.DOMElements.cqBadge.textContent = this.commandQueue.length; this.DOMElements.cqContainer.style.display = this.commandQueue.length > 0 ? 'block' : 'none'; this.DOMElements.cqBadge.style.display = this.commandQueue.length > 0 ? 'grid' : 'none'; this.DOMElements.cqList.scrollTop = this.DOMElements.cqList.scrollHeight; },

        updateInputBar() { const h = this.DOMElements.chatInput.value.trim().length > 0; this.DOMElements.sendBtn.style.display = h ? 'flex' : 'none'; this.DOMElements.plusBtn.style.display = h ? 'none' : 'flex'; this.DOMElements.chatInput.style.height = 'auto'; this.DOMElements.chatInput.style.height = `${Math.min(this.DOMElements.chatInput.scrollHeight, 100)}px`; },

        // ---------- UI Interactions / Event Handlers ----------
        setupEventListeners() {
            this.DOMElements.phone.addEventListener('click', e => {
                const C = s => e.target.closest(s); let target;
                if (C('.interactive-bubble-wrapper') || C('.sticker-item') || C('.delete-sticker-btn') || C('#boli-bite-app') || C('#boli-campus-card-app')) return;
                if (target = C('#weather-widget')) { this.navigateTo('weather-app-view'); }
                else if (target = C('.weather-back-button')) { this.navigateTo('home-screen'); }
                else if (target = C('.app-icon')) { e.preventDefault(); this.navigateTo(target.dataset.app); }
                else if (target = C('.nav-link')) { e.preventDefault(); this.navigateTo(target.dataset.targetView); }
                else if (target = C('.back-button')) { e.preventDefault(); target.dataset.action === 'go-home' ? this.goHome() : this.navigateBack(); }
                else if (target = C('.chat-list-item')) { e.preventDefault(); this.navigateTo('chat-window-view', { chatId: target.dataset.chatId }); }
                else if (target = C('.tab-item')) { e.preventDefault(); this.switchTab(target.dataset.tab); }
                else if (target = C('#new-friend-btn')) { e.preventDefault(); this.navigateTo('friend-requests-view'); }
                else if (target = C('#group-chat-btn')) { e.preventDefault(); this.createGroupChat(); }
                else if (target = C('.contact-item')) { e.preventDefault(); this.handleContactClick(C('.contact-item')); }
                else if (target = C('#manual-add-friend-topbar')) { e.preventDefault(); this.addNewFriend(); }
                else if ((target = C('.accept-btn')) && !target.disabled) { e.preventDefault(); const r = C('.friend-request-item'); if(r) this.handleFriendRequest(r.dataset.requestId, target); }
                else if (target = C('.message-row.deletable')) { e.preventDefault(); const timestamp = target.dataset.timestamp; this.handleDeleteMessage(timestamp); }
                const momentItem = C('.moment-item'); if (momentItem) { e.preventDefault(); const popup = momentItem.querySelector('.moment-actions-popup'); if (C('.moment-actions-btn')) { document.querySelectorAll('.moment-actions-popup.active').forEach(p => p !== popup && p.classList.remove('active')); popup.classList.toggle('active'); return; } const mId = momentItem.dataset.momentId, mData = this.state.momentsLog.find(m => m.id === mId); if (!mData) return; if (C('.action-like')) { const iLiked = mData.likes?.includes(this.state.config.user_name); this.queueCommand(iLiked ? `[我取消了给 ${mData.author} 朋友圈的点赞]` : `[我给 ${mData.author} 的朋友圈点了赞]`); iLiked ? mData.likes.splice(mData.likes.indexOf(this.state.config.user_name), 1) : (mData.likes = mData.likes || []).push(this.state.config.user_name); popup.classList.remove('active'); this.saveState(); this.renderMoments(); } else if (C('.action-comment')) { const text = prompt(`评论 ${mData.author}:`); if (text) { this.queueCommand(`[我评论了 ${mData.author} 的朋友圈：\n${text}]`); (mData.comments = mData.comments || []).push({author:this.state.config.user_name, text}); popup.classList.remove('active'); this.saveState(); this.renderMoments(); } } else if (C('.action-delete')) { if (confirm("确定要删除这条朋友圈吗？")) { this.state.momentsLog = this.state.momentsLog.filter(m => m.id !== mId); popup.classList.remove('active'); this.saveState(); this.renderMoments(); this.queueCommand(`[我删除了我发布的一条朋友圈]`); this.showIslandNotification('<i class="fas fa-trash-alt"></i>', '朋友圈已删除'); } } } if (!C('.moment-actions-btn')) document.querySelectorAll('.moment-actions-popup.active').forEach(p => p.classList.remove('active'));
            });

            this.DOMElements.chatOptionsBtn.addEventListener('click', () => this.navigateTo('chat-info-view'));
            this.DOMElements.chatInfoContent.addEventListener('click', e => {
                const target = e.target.closest('[data-action]'); if (!target) return; const action = target.dataset.action;
                const actions = { 'change-chat-name': () => this.handleChangeChatName(this.currentChat, this.currentChat.type === 'group' ? '群聊名称' : '好友备注'), 'change-chat-avatar': () => this.handleChangeChatAvatar(this.currentChat), 'clear-chat-history': () => this.handleClearChatHistory(this.currentChat), 'disband-group': () => this.handleDisbandGroup(this.currentChat), 'exit-group': () => this.handleExitGroup(this.currentChat), 'delete-contact': () => this.handleDeleteContact(this.currentChat), 'invite-member': () => this.handleInviteMember(this.currentChat), 'remove-member': () => this.handleRemoveMember(this.currentChat), 'apply-admin': () => this.handleApplyAdmin(this.currentChat) }; if (actions[action]) actions[action]();
            });

            this.DOMElements.sendBtn.addEventListener('click', () => { const msg = this.DOMElements.chatInput.value; this.DOMElements.chatInput.value = ''; this.updateInputBar(); setTimeout(() => this.sendUserMessage(msg), 0); });
            this.DOMElements.chatInput.addEventListener('input', this.updateInputBar.bind(this));
            this.DOMElements.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.DOMElements.sendBtn.click(); } });

            this.DOMElements.emojiBtn.addEventListener('click', e => { e.stopPropagation(); this.togglePanel('emoji'); });
            this.DOMElements.plusBtn.addEventListener('click', e => { e.stopPropagation(); this.togglePanel('plus'); });

            this.DOMElements.emojiMenu.addEventListener('click', e => { e.preventDefault(); const stickerItem = e.target.closest('.sticker-item'); if (!stickerItem) return; if (e.target.closest('.delete-sticker-btn')) { const nameToDelete = stickerItem.dataset.name; if (confirm(`确定要删除表情 “${nameToDelete}” 吗？`)) { delete this.STICKERS[nameToDelete]; this.saveState(); this.renderEmojiMenu(); this.showIslandNotification('<i class="fas fa-trash-alt"></i>', '表情已删除'); } return; } if (stickerItem.classList.contains('add-sticker-btn')) { const name = prompt("请输入新表情的名称："); if (!name || !name.trim()) return; const url = prompt(`请输入 “${name}” 的图片URL：`); if (!url || !url.trim()) return; if (this.STICKERS[name.trim()]) { if (!confirm(`已存在名为“${name.trim()}”的表情，要覆盖它吗？`)) return; } this.STICKERS[name.trim()] = url.trim(); this.saveState(); this.renderEmojiMenu(); this.showIslandNotification('<i class="fas fa-plus"></i>', '表情已添加'); return; } const stickerName = stickerItem.dataset.name; if (stickerName) { this.sendUserMessage(`[表情: ${stickerName}]`); this.togglePanel(null); } });

            this.DOMElements.plusMenu.addEventListener('click', (e) => { const item = e.target.closest('.plus-menu-item'); if (!item) return; const feature = this.PLUS_FEATURES.find(f => f.label === item.dataset.actionLabel); if (feature) feature.action(); });

            this.DOMElements.postMomentBtn.addEventListener('click', () => { const text = prompt("这一刻的想法..."); if (text === null) return; const images = prompt("图片URL(多个用空格隔开)")?.split(' ').filter(Boolean) || []; const newMoment = { id: `moment_local_${Date.now()}`, author: this.state.config.user_name, avatar: this.state.config.user_avatar, text: text, images: images, time: "刚刚", likes: [], comments: [] }; this.state.momentsLog.push(newMoment); this.saveState(); this.renderMoments(); this.queueCommand(`[我发了朋友圈：\n${text}${images.length ? '\n[附带图片]' : ''}]`); });

            const settingsMap = { 'setting_chat_wallpaper': { l: '聊天背景', k: 'chat_wallpaper' }, 'setting_home_wallpaper': { l: '主页壁纸', k: 'home_wallpaper' }, 'setting_moments_cover': { l: '朋友圈封面', k: 'moments_cover' }, 'setting_user_avatar': { l: '我的头像', k: 'user_avatar' }, 'setting_user_name': { l: '我的昵称', k: 'user_name' }, 'setting_moments_signature': { l: '个性签名', k: 'moments_signature' } };
            Object.entries(settingsMap).forEach(([id, { l, k }]) => { document.getElementById(id)?.addEventListener('click', () => { const nV = prompt(`输入新的${l}:`, this.state.config[k] || ''); this.applySettingChange(k, nV); }); });

            document.getElementById('setting_clear_storage')?.addEventListener('click', () => { if (confirm("【警告】确定要清除所有本地数据吗？此操作不可恢复。")) { localStorage.removeItem(this.STORAGE_KEY_STATE); localStorage.removeItem(this.STORAGE_KEY_MESSAGES); if(window.BoliCampusCardApp) localStorage.removeItem(window.BoliCampusCardApp.STORAGE_KEY); location.reload(); } });

            this.DOMElements.cqSendBtn.addEventListener('click', () => {
                if (this.commandQueue.length === 0) return;
                let totalDeduction = 0; const descriptiveCommands = []; const paymentRegex = /\[CMD_PAY:(\d+\.?\d*)\]\s*/;
                this.commandQueue.forEach(cmd => { const match = cmd.match(paymentRegex); if (match) { totalDeduction += parseFloat(match[1]); descriptiveCommands.push(cmd.replace(paymentRegex, '')); } else { descriptiveCommands.push(cmd); } });
                if (totalDeduction > 0 && window.BoliCampusCardApp) { window.BoliCampusCardApp.updateBalance(-totalDeduction); }
                if (descriptiveCommands.length > 0) { this.sendCommandToAI(descriptiveCommands.join('\n')); }
                this.commandQueue.length = 0; this.updateCommandQueueUI(); this.DOMElements.cqContainer.classList.remove('expanded');
            });
            this.DOMElements.cqClearBtn.addEventListener('click', () => { if (this.commandQueue.length > 0 && confirm(`清空 ${this.commandQueue.length} 条待发送指令？`)) { this.commandQueue.length = 0; this.updateCommandQueueUI(); this.DOMElements.cqContainer.classList.remove('expanded'); } });

            let isDragging = false, hasDragged = false, oX, oY; const fab = this.DOMElements.cqContainer; const startDrag = (e) => { isDragging = true; hasDragged = false; fab.classList.add('dragging'); const ev = e.touches ? e.touches[0] : e; oX = ev.clientX - fab.offsetLeft; oY = ev.clientY - fab.offsetTop; }; const drag = (e) => { if (!isDragging) return; hasDragged = true; e.preventDefault(); const ev = e.touches ? e.touches[0] : e; let nX = ev.clientX - oX, nY = ev.clientY - oY; const b = document.body.getBoundingClientRect(); fab.style.left = `${Math.max(0, Math.min(nX, b.width - fab.offsetWidth))}px`; fab.style.top = `${Math.max(0, Math.min(nY, b.height - fab.offsetHeight))}px`; fab.style.right = 'auto'; fab.style.transform = 'none'; }; const endDrag = () => { isDragging = false; fab.classList.remove('dragging'); };
            fab.addEventListener('mousedown', startDrag); fab.addEventListener('touchstart', startDrag, { passive: false }); document.addEventListener('mousemove', drag); document.addEventListener('touchmove', drag, { passive: false }); document.addEventListener('mouseup', endDrag); document.addEventListener('touchend', endDrag);
            this.DOMElements.cqFab.addEventListener('click', () => { if (!hasDragged) this.DOMElements.cqContainer.classList.toggle('expanded'); });
            document.addEventListener('click', (e) => { if (this.DOMElements.cqContainer?.classList.contains('expanded') && !e.target.closest('#cq-container')) { this.DOMElements.cqContainer.classList.remove('expanded'); } });
        },

        switchTab(tabId) { const t = this.DOMElements.wechatApp.querySelector(`.tab-item[data-tab="${tabId}"]`); this.DOMElements.wechatApp.querySelector('.wechat-tab-view.active')?.classList.remove('active'); document.getElementById(tabId)?.classList.add('active'); this.DOMElements.wechatApp.querySelector('.tab-item.active')?.classList.remove('active'); t.classList.add('active'); this.DOMElements.wechatTitle.textContent = t.dataset.title; },

        togglePanel(pName) {
            const pId = pName === 'emoji' ? 'chat-emoji-menu' : pName === 'plus' ? 'chat-plus-menu' : null;
            if (!pId) { this.DOMElements.panelContainer.classList.remove('active'); return; }
            const tPanel = document.getElementById(pId), isActive = this.DOMElements.panelContainer.classList.contains('active') && tPanel.classList.contains('active');
            if (isActive) this.DOMElements.panelContainer.classList.remove('active');
            else { this.DOMElements.phone.querySelectorAll('.panel-view').forEach(p => p.classList.remove('active')); tPanel.classList.add('active'); if (!this.DOMElements.panelContainer.classList.contains('active')) this.DOMElements.panelContainer.classList.add('active'); }
        },

        // Message Parsing and handling
        parseMessageContent(content, isSent) {
            let match;
            const interactiveTypes = { '转账': 'transfer', '红包': 'red_packet', '礼物': 'gift', '文件': 'file' };
            for (const key in interactiveTypes) { const regex = new RegExp(`^\\[${key}:\\s*(\\{.*?\\})\\]$`); if (match = content.match(regex)) { try { const data = JSON.parse(match[1]); const type = interactiveTypes[key]; return { type: type, bubbleClass: 'interactive-bubble', html: this.createInteractiveBubbleHTML(type, data, isSent), data: data, isInteractive: true }; } catch (e) { console.warn("Failed to parse interactive message:", content, e); } } }
            if (match = content.match(/^\[位置:\s*([^\]]+)\]$/)) return { type: 'location', bubbleClass: 'interactive-bubble', html: this.createInteractiveBubbleHTML('location', match[1], isSent) };
            if (match = content.match(/\[表情:\s*([^\]]+)\]/)) return { type: 'sticker', bubbleClass: 'sticker-bubble', html: `<img class="custom-emoji" src="${this.STICKERS[match[1]] || ''}" alt="${match[1]}">` };
            if (match = content.match(/\[链接:\s*([^\]]+)\]/)) return { type: 'link', bubbleClass: 'link-bubble', html: `<div class="icon"><i class="fas fa-link"></i></div><span>${match[1]}</span>` };
            if (match = content.match(/\[图片:\s*{(.*)}\]/)) try { const d = JSON.parse(`{${match[1]}}`); return { type: 'image', bubbleClass: 'image-bubble', html: `<div class="image-placeholder">${d.value}</div>` }; } catch (e) { }
            return { type: 'text', bubbleClass: '', html: content, isInteractive: false };
        },

        createInteractiveBubbleHTML(type, data, isSent) {
            let iconHtml = '', title = '', subtitle = '', footerText = '微信'; const statusMap = { pending: isSent ? '等待对方领取' : `转账给你`, received: data.receiver ? `已被“${data.receiver}”领取` : '已被领取', returned: '已退还' };
            switch (type) {
                case 'transfer': iconHtml = '<i class="fas fa-exchange-alt"></i>'; title = `¥${Number(data.amount).toFixed(2)}`; subtitle = data.remark || '转账'; footerText = `微信转账`; if (data.status && data.status !== 'pending') { subtitle = statusMap[data.status] || data.status; } if (data.status === 'pending' && !isSent) subtitle = '转账给你'; return `<div class="interactive-bubble-wrapper transfer-bubble" onclick="handleInteractiveBubbleClick(this, ${isSent})"><div class="interactive-bubble-main"><div class="icon">${iconHtml}</div><div class="text-content"><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div></div><div class="interactive-bubble-footer">${footerText}</div></div>`;
                case 'red_packet': iconHtml = '<i class="fas fa-wallet"></i>'; title = data.blessing || '恭喜发财，大吉大利！'; subtitle = (data.status === 'received') ? '已被领取' : '微信红包'; footerText = "微信红包"; return `<div class="interactive-bubble-wrapper red-packet-bubble" onclick="handleInteractiveBubbleClick(this, ${isSent})"><div class="interactive-bubble-main"><div class="icon">${iconHtml}</div><div class="text-content"><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div></div><div class="interactive-bubble-footer">${footerText}</div></div>`;
                case 'gift': iconHtml = '<i class="fas fa-gift"></i>'; title = data.name || '一份心意'; subtitle = (data.status === 'received') ? '已收下' : '微信礼物'; footerText = "微信礼物"; return `<div class="interactive-bubble-wrapper gift-bubble" onclick="handleInteractiveBubbleClick(this, ${isSent})"><div class="main-content-wrapper"><div class="interactive-bubble-main"><div class="icon">${iconHtml}</div><div class="text-content"><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div></div><div class="interactive-bubble-footer">${footerText}</div></div></div>`;
                case 'file': iconHtml = '<i class="far fa-file"></i>'; title = data.name || '未知文件'; subtitle = data.size || ''; return `<div class="interactive-bubble-wrapper file-bubble"><div class="interactive-bubble-main"><div class="icon">${iconHtml}</div><div class="text-content"><div class="title">${title}</div><div class="subtitle">${subtitle}</div></div></div>`;
                case 'location': title = data; return `<div class="interactive-bubble-wrapper location-bubble"><div class="location-info"><div class="title">${title}</div></div><div class="map-display"></div></div>`;
            }
        },

        handleInteractiveBubbleClick(element, isSent) { if (isSent) return; const type = element.dataset.type; const data = JSON.parse(element.dataset.content); if (data.status !== 'pending') return; let action, command; const recipient = this.currentChat.type === 'group' ? `群聊：“${this.currentChat.name.replace(/\s*\(\d+\)$/, '')}”` : `“${this.currentChat.name}”`; switch (type) { case 'transfer': action = prompt(`对${recipient}的转账，输入“领取”或“退还”：`); if (action === '领取') { command = `[我领取了${recipient}的转账]`; } else if (action === '退还') { command = `[我退还了${recipient}的转账]`; } break; case 'red_packet': if (confirm(`领取${recipient}的红包吗？`)) { command = `[我领取了${recipient}的红包]`; } break; case 'gift': if (confirm(`收下${recipient}的礼物“${data.name}”吗？`)) { command = `[我收下了${recipient}的礼物：“${data.name}”]`; } break; } if (command) { this.queueCommand(command); this.showIslandNotification('<i class="fas fa-paper-plane"></i>', '指令已发送'); } },

        // ---------- Action Handlers ----------
        sendUserMessage(rawContent) { const content = rawContent.trim(); if (!content || !this.currentChat) return; const msg = { type: 'USER', content, timestamp: Date.now() }; this.renderChatWindow(this.currentChat.id, msg); this.saveUserMessageToStorage(this.currentChat.id, msg); this.showIslandNotification('<i class="fas fa-check"></i>', '消息已发送'); const verb = (this.currentChat.type === 'group') ? `我在群聊“${this.currentChat.name.replace(/\s*\(\d+\)$/, '')}”里说：` : `我回复${this.currentChat.name}：`; this.queueCommand(`[${verb}\n${content}]`); },

        handleContactClick(contactItem) { const contact = this.state.contacts.find(c => c.id === contactItem.dataset.contactId); if (!contact) return; const chat = this.state.chatList.find(c => c.type === 'private' && c.name === contact.name); if (chat) { this.navigateTo('chat-window-view', { chatId: chat.id }); } else { const newId = `chat_local_${Date.now()}`; const newChat = { id: newId, type: "private", name: contact.name, avatar: contact.avatar, unread: 0, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), latest_msg: "" }; this.state.chatList.unshift(newChat); this.state.chatLogs[newId] = [{ type: 'SYSTEM', content: '现在可以开始聊天了', timestamp: Date.now() }]; const contactToUpdate = this.state.contacts.find(c => c.id === contact.id); if (contactToUpdate) contactToUpdate.id = newId; this.saveState(); this.fullRender(); this.navigateTo('chat-window-view', { chatId: newChat.id }); this.queueCommand(`[我主动与好友“${contact.name}”发起了聊天]`); } },

        addNewFriend() { const name = prompt("输入新朋友的昵称："); if (!name || !name.trim()) return; const n = name.trim(); if (this.state.contacts.some(c => c.name === n)) { alert("该联系人已存在。"); return; } const newId = `contact_local_${Date.now()}`; this.state.contacts.push({ id: newId, name: n, avatar: `https://i.pravatar.cc/150?u=${newId}` }); this.state.contactMap[n] = this.state.contacts.find(c => c.id === newId); this.saveState(); this.queueCommand(`[我添加了新好友：“${n}”]`); this.renderContacts(); this.showIslandNotification('<i class="fas fa-user-check"></i>', `已添加 ${n}`); },

        createGroupChat() { const cList = this.state.contacts.map(c => c.name).filter(name => name !== this.state.config.user_name).join(', '); if (!cList) { alert("通讯录中还没有其他联系人，无法创建群聊。"); return; } const namesStr = prompt(`选择群成员（用英文逗号,隔开）：\n${cList}`); if (!namesStr) return; const gName = prompt("为群聊命名："); if (!gName || !gName.trim()) return; const members = namesStr.split(',').map(n => n.trim()).filter(n => this.state.contactMap[n]); if (members.length < 1) { alert("至少需要1位其他成员"); return; } const allMembers = [this.state.config.user_name, ...members]; const groupId = `group_local_${Date.now()}`; const newChat = { id: groupId, type: "group", name: `${gName.trim()} (${allMembers.length})`, avatar: `https://i.pravatar.cc/150?u=${groupId}`, unread: 0, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), latest_msg: `${this.state.config.user_name}邀请${members.join(',')}加入了群聊`, members: allMembers, admins: [this.state.config.user_name] }; this.state.chatList.unshift(newChat); this.state.chatLogs[groupId] = [{ type: "SYSTEM", content: `你邀请${members.join(', ')}加入了群聊`, timestamp: Date.now() }]; this.saveState(); this.queueCommand(`[我创建了群聊“${gName.trim()}”，并邀请了${members.join(',')}。]`); this.fullRender(); this.showIslandNotification('<i class="fas fa-users"></i>', `群聊“${gName.trim()}”已创建`); },

        applySettingChange(key, newValue) { if (newValue === null || newValue === '' || newValue === this.state.config[key]) return; this.state.config[key] = newValue; this.queueCommand(`[我将我的${{ user_name: '昵称', user_avatar: '头像', home_wallpaper: '主页壁纸', chat_wallpaper: '聊天背景', moments_cover: '朋友圈封面', moments_signature: '个性签名' }[key] || key}更新为：“${newValue}”]`); this.saveState(); this.fullRender(); },

        handleFriendRequest(requestId, button) { const reqIndex = this.state.friendRequests.findIndex(r => r.id === requestId); if (reqIndex === -1) return; const req = this.state.friendRequests[reqIndex]; const newContact = { id: req.id.replace('req_', 'contact_'), name: req.name, avatar: req.avatar }; if (!this.state.contacts.some(c => c.name === newContact.name)) { this.state.contacts.push(newContact); } this.state.friendRequests.splice(reqIndex, 1); this.state.handledRequestIds.push(requestId); button.textContent = '已添加'; button.disabled = true; this.queueCommand(`[我同意了“${req.name}”的好友申请]`); this.showIslandNotification('<i class="fas fa-user-check"></i>', `已添加 ${req.name}`); this.saveState(); this.renderFriendRequestsView(); this.renderContacts(); },

        handleDeleteMessage(timestamp) { if (!this.currentChat || !timestamp) return; if (!confirm("确定要删除这条消息吗？")) return; const ts = parseFloat(timestamp); let wasDeleted = false; const logIndex = this.state.chatLogs[this.currentChat.id]?.findIndex(m => m.timestamp === ts); if (logIndex > -1) { this.state.chatLogs[this.currentChat.id].splice(logIndex, 1); this.saveState(); wasDeleted = true; } else { let userMsgs = this.getUserMessagesFromStorage(this.currentChat.id); const initialLength = userMsgs.length; const updatedUserMsgs = userMsgs.filter(m => m.timestamp !== ts); if (updatedUserMsgs.length < initialLength) { this.saveUserMessages(this.currentChat.id, updatedUserMsgs); wasDeleted = true; } } if (wasDeleted) { this.renderChatWindow(this.currentChat.id); this.queueCommand(`[我删除了与“${this.currentChat.name}”聊天中的一条消息]`); this.showIslandNotification('<i class="fas fa-trash-alt"></i>', '消息已删除'); } },

        handleChangeChatName(chat, nameLabel) { const oldName = chat.name.replace(/\s*\(\d+\)$/, ''); const newName = prompt(`输入新的${nameLabel}:`, oldName); if (newName && newName.trim() && newName.trim() !== oldName) { const memberCountMatch = chat.name.match(/(\(\d+)\)$/); const memberCountStr = memberCountMatch ? ` ${memberCountMatch[1]}` : ''; chat.name = newName.trim() + memberCountStr; this.currentChat.name = chat.name; const contact = this.state.contacts.find(c => c.id === chat.id); if (contact) contact.name = chat.name.replace(/\s*\(\d+\)$/, ''); this.saveState(); this.fullRender(); this.DOMElements.chatWindowTitle.textContent = chat.name; this.renderChatInfoView(); this.queueCommand(`[我将“${oldName}”的名称修改为“${newName.trim()}”]`); this.showIslandNotification('<i class="fas fa-pen"></i>', '名称已更新'); } },

        handleChangeChatAvatar(chat) { const oldAvatar = this.state.avatarOverrides[chat.id] || chat.avatar; const newAvatar = prompt(`为“${chat.name.replace(/\s*\(\d+\)$/, '')}”输入新的头像URL:`, oldAvatar); if (newAvatar && newAvatar.trim() && newAvatar !== oldAvatar) { const finalAvatar = newAvatar.trim(); this.state.avatarOverrides[chat.id] = finalAvatar; chat.avatar = finalAvatar; if (this.currentChat.id === chat.id) this.currentChat.avatar = finalAvatar; const contact = this.state.contacts.find(c => c.id === chat.id); if (contact) contact.avatar = finalAvatar; this.saveState(); this.fullRender(); if (this.DOMElements.chatWindow.classList.contains('active')) this.renderChatWindow(chat.id); if (this.DOMElements.chatInfoView.classList.contains('active')) this.renderChatInfoView(); this.queueCommand(`[我将“${chat.name.replace(/\s*\(\d+\)$/, '')}”的头像进行了更换]`); this.showIslandNotification('<i class="fas fa-image"></i>', '头像已更新'); } },

        handleClearChatHistory(chat) { if (confirm(`【警告】确定要清空“${chat.name}”的所有聊天记录吗？\n此操作不可恢复。`)) { delete this.state.chatLogs[chat.id]; this.clearUserMessagesFromStorage(chat.id); chat.latest_msg = ""; chat.unread = 0; chat.time = ""; this.saveState(); this.renderChatWindow(chat.id); this.renderChatList(); this.queueCommand(`[我清空了与“${chat.name}”的聊天记录]`); this.showIslandNotification('<i class="fas fa-trash"></i>', '记录已清空'); } },

        handleDisbandGroup(chat) { if (confirm(`【警告】您是管理员，确定要解散群聊“${chat.name}”吗？\n此操作不可恢复。`)) { const chatId = chat.id; this.state.chatList = this.state.chatList.filter(c => c.id !== chatId); delete this.state.chatLogs[chatId]; delete this.state.avatarOverrides[chatId]; this.clearUserMessagesFromStorage(chatId); this.saveState(); this.queueCommand(`[我解散了群聊“${chat.name}”]`); this.showIslandNotification('<i class="fas fa-users-slash"></i>', '群聊已解散'); this.navigateTo('wechat-app'); this.fullRender(); } },

        handleDeleteContact(chat) { if (confirm(`【警告】确定要删除联系人“${chat.name}”吗？\n与该联系人的聊天记录也将被一并删除，此操作不可恢复。`)) { const chatId = chat.id; this.state.contacts = this.state.contacts.filter(c => c.id !== chatId); this.state.chatList = this.state.chatList.filter(c => c.id !== chatId); delete this.state.chatLogs[chatId]; delete this.state.avatarOverrides[chatId]; this.clearUserMessagesFromStorage(chatId); this.saveState(); this.queueCommand(`[我删除了联系人“${chat.name}”]`); this.showIslandNotification('<i class="fas fa-user-minus"></i>', `${chat.name} 已被删除`); this.navigateTo('wechat-app'); this.fullRender(); } },

        handleExitGroup(chat) { if (confirm(`确定要退出群聊“${chat.name}”吗？`)) { const chatId = chat.id; this.state.chatList = this.state.chatList.filter(c => c.id !== chatId); delete this.state.chatLogs[chatId]; delete this.state.avatarOverrides[chatId]; this.clearUserMessagesFromStorage(chatId); this.saveState(); this.queueCommand(`[我退出了群聊“${chat.name}”]`); this.showIslandNotification('<i class="fas fa-sign-out-alt"></i>', '已退出群聊'); this.navigateTo('wechat-app'); this.fullRender(); } },

        handleInviteMember(chat) { const availableToInvite = this.state.contacts.filter(c => !(chat.members || []).includes(c.name)).map(c => c.name).join(', '); if (!availableToInvite) { alert("没有可以邀请的联系人了。"); return; } const nameStr = prompt(`邀请谁加入群聊？（可多选，用英文逗号,隔开）\n可选: ${availableToInvite}`); if (!nameStr || !nameStr.trim()) return; const namesToInvite = nameStr.split(',').map(n => n.trim()).filter(Boolean); const addedNames = []; namesToInvite.forEach(name => { if (!chat.members.includes(name) && this.state.contacts.some(c=>c.name===name)) { chat.members.push(name); addedNames.push(name); } }); if (addedNames.length > 0) { const countMatch = chat.name.match(/\((\d+)\)/); const newCount = countMatch ? parseInt(countMatch[1]) + addedNames.length : chat.members.length; chat.name = `${chat.name.replace(/\s*\(\d+\)$/, '')} (${newCount})`; this.saveState(); this.fullRender(); this.renderChatInfoView(); this.queueCommand(`[我将“${addedNames.join(', ')}”邀请加入了群聊“${chat.name.replace(/\s*\(\d+\)$/, '')}”]`); this.showIslandNotification('<i class="fas fa-user-plus"></i>', `已邀请 ${addedNames.length} 位成员`); } },

        handleRemoveMember(chat) { const removableMembers = (chat.members || []).filter(m => m !== this.state.config.user_name).join(', '); if(!removableMembers) { alert("没有可移出的成员。"); return; } const name = prompt(`要从群聊中移出谁？\n${removableMembers}`); if (name && name.trim()) { const memberIndex = chat.members.indexOf(name.trim()); if (memberIndex > -1){ chat.members.splice(memberIndex, 1); const adminIndex = (chat.admins || []).indexOf(name.trim()); if(adminIndex > -1) chat.admins.splice(adminIndex, 1); const countMatch = chat.name.match(/\((\d+)\)/); const newCount = countMatch ? parseInt(countMatch[1]) - 1 : chat.members.length; chat.name = `${chat.name.replace(/\s*\(\d+\)$/, '')} (${newCount})`; this.saveState(); this.fullRender(); this.renderChatInfoView(); this.queueCommand(`[我将“${name.trim()}”移出了群聊“${chat.name.replace(/\s*\(\d+\)$/, '')}”]`); this.showIslandNotification('<i class="fas fa-user-minus"></i>', `已移出 ${name.trim()}`); } else { alert("该成员不在群聊中。"); } } },

        handleApplyAdmin(chat) { if(confirm(`确定要向群主申请成为“${chat.name.replace(/\s*\(\d+\)$/, '')}”的管理员吗？`)) { this.queueCommand(`[我向群主申请成为群聊“${chat.name.replace(/\s*\(\d+\)$/, '')}”的管理员]`); this.showIslandNotification('<i class="fas fa-paper-plane"></i>', `申请已发送`); } },
    };

    // 将主模块挂载到window上
    window.PhoneUI = PhoneUI;

})();
