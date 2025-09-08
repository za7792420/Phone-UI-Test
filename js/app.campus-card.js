(function () {
    'use strict';

    // 防止重复定义
    if (window.BoliCampusCardApp) return;

    const BoliCampusCardApp = {
        STORAGE_KEY: 'st_phone_ui_v19_campus_card',
        DOM: {},
        state: {
            name: '未认证', id: 'N/A', type: '学生', school: '博理公学', balance: 0.00,
            avatar: '', age: '',
            grade: '', college: '',
            position: '', department: ''
        },

        init() {
            this.DOM = {
                app: document.querySelector('#boli-campus-card-app'),
                backButton: document.querySelector('#boli-campus-card-app .back-button'),
                schoolName: document.getElementById('bcc-school-name'),
                cardType: document.getElementById('bcc-card-type'),
                balance: document.getElementById('bcc-balance'),
                personName: document.getElementById('bcc-person-name'),
                personId: document.getElementById('bcc-person-id'),
                editBtn: document.getElementById('bcc-edit-btn'),
                idAvatar: document.getElementById('bcc-id-avatar'),
                idName: document.getElementById('bcc-id-name'),
                idAge: document.getElementById('bcc-id-age'),
                idDetails: document.getElementById('bcc-id-details'),
                boliBiteBalanceDisplay: document.getElementById('bb-balance-display'),
                showQrBtn: document.getElementById('bcc-show-qr-btn'),
                qrModal: document.getElementById('bcc-qr-modal'),
            };
            this.loadState();
            this.addEventListeners();
            this.render();
        },

        loadState() {
            try {
                const savedState = localStorage.getItem(this.STORAGE_KEY);
                if (savedState) { this.state = { ...this.state, ...JSON.parse(savedState) }; }
            } catch (e) {
                console.error("Error loading Campus Card state:", e);
                this.saveState();
            }
        },

        saveState() {
            try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state)); }
            catch (e) { console.error("Error saving Campus Card state:", e); }
        },

        render() {
            if (!this.DOM.schoolName) return; // Guard clause if DOM not ready
            this.DOM.schoolName.textContent = this.state.school;
            this.DOM.cardType.textContent = this.state.type ? `${this.state.type}卡` : '校园卡';
            this.DOM.balance.textContent = this.state.balance.toFixed(2);
            this.DOM.personName.textContent = this.state.name;
            this.DOM.personId.textContent = `ID: ${this.state.id}`;
            this.DOM.idAvatar.style.backgroundImage = this.state.avatar ? `url('${this.state.avatar}')` : 'none';
            this.DOM.idName.textContent = this.state.name;
            this.DOM.idAge.textContent = this.state.age ? `${this.state.age}岁` : '';
            let detailsHtml = '';
            if (this.state.type === '学生') {
                detailsHtml += `<div class="id-row"><span class="label">年级:</span><span class="value">${this.state.grade || 'N/A'}</span></div>`;
                detailsHtml += `<div class="id-row"><span class="label">住宿院区:</span><span class="value">${this.state.college || 'N/A'}</span></div>`;
            } else if (this.state.type === '教职工') {
                detailsHtml += `<div class="id-row"><span class="label">职位:</span><span class="value">${this.state.position || 'N/A'}</span></div>`;
                detailsHtml += `<div class="id-row"><span class="label">所属部门:</span><span class="value">${this.state.department || 'N/A'}</span></div>`;
            }
            this.DOM.idDetails.innerHTML = detailsHtml;
            if (this.DOM.boliBiteBalanceDisplay) { this.DOM.boliBiteBalanceDisplay.textContent = `¥ ${this.state.balance.toFixed(2)}`; }

            // Check if BoliBiteApp is loaded and has the necessary method
            if (window.BoliBiteApp && typeof window.BoliBiteApp.renderCart === 'function' && window.BoliBiteApp.state.currentView === 'cart') {
                window.BoliBiteApp.renderCart();
            }
        },

        addEventListeners() {
            if (this.DOM.backButton) {
                this.DOM.backButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if(window.PhoneUI) window.PhoneUI.navigateBack();
                });
            }
            this.DOM.editBtn.addEventListener('click', () => this.handleEdit());
            this.DOM.app.addEventListener('click', e => {
                const paymentOption = e.target.closest('.payment-option');
                if (paymentOption) { this.handleRecharge(paymentOption.dataset.channel); }
            });
            this.DOM.showQrBtn.addEventListener('click', () => { this.DOM.qrModal.classList.add('visible'); });
            this.DOM.qrModal.addEventListener('click', () => { this.DOM.qrModal.classList.remove('visible'); });
        },

        handleEdit() {
            const type = prompt("请更新您的身份 (学生/教职工):", this.state.type);
            if (type !== '学生' && type !== '教职工') { alert("身份认证失败，请输入“学生”或“教职工”。"); return; }
            const name = prompt("姓名:", this.state.name);
            const id = prompt("学号/工号:", this.state.id);
            const avatar = prompt("头像URL:", this.state.avatar);
            const age = prompt("年龄:", this.state.age);
            this.state.type = type;
            this.state.name = name || '未认证';
            this.state.id = id || 'N/A';
            this.state.avatar = avatar || '';
            this.state.age = age || '';
            if (type === '学生') {
                this.state.grade = prompt("年级 (例如: G10 / G11 / G12):", this.state.grade);
                this.state.college = prompt("住宿院区 (1-12院区):", this.state.college);
                this.state.position = ''; this.state.department = '';
            } else {
                this.state.position = prompt("职位 (例如: 教师 / 行政):", this.state.position);
                this.state.department = prompt("所属部门:", this.state.department);
                this.state.grade = ''; this.state.college = '';
            }
            this.saveState();
            this.render();
            if(window.PhoneUI) {
                window.PhoneUI.queueCommand(`[我更新了“一卡通”的身份信息。身份：${type}，姓名：${this.state.name}]`);
                window.PhoneUI.showIslandNotification('<i class="fas fa-check"></i>', '身份信息已更新');
            }
        },

        handleRecharge(channel) {
            const amountStr = prompt(`通过 [${channel.toUpperCase()}] 充值，请输入金额:`, "100");
            if (!amountStr) return;
            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) { alert("请输入有效的充值金额。"); return; }
            this.state.balance += amount;
            this.saveState();
            this.render();
            if(window.PhoneUI) {
                window.PhoneUI.queueCommand(`[我通过“一卡通”App使用${channel}为校园卡充值 ¥${amount.toFixed(2)}]`);
                window.PhoneUI.showIslandNotification('<i class="fas fa-wallet"></i>', `充值 ¥${amount.toFixed(2)} 成功`);
            }
        },

        updateBalance(amount) {
            this.state.balance += amount; // Can be positive (refund) or negative (deduction)
            this.saveState();
            this.render();
            return true; // Assume success, checks are done elsewhere
        }
    };

    // 将模块挂载到window上，以便其他模块可以访问
    window.BoliCampusCardApp = BoliCampusCardApp;
})();
