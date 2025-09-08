(function () {
    'use strict';

    // 防止重复定义
    if (window.BoliBiteApp) return;

    const BoliBiteApp = {
        RESTAURANT_DATA: {},
        DOM: {},
        state: {
            cart: [],
            currentView: 'list',
            currentRestaurantId: null,
            lastNavigatedView: 'list',
            cameToCartFrom: null,
            delivery: { method: '无人机配送', pickupPoint: null },
        },
        DELIVERY_OPTIONS: { '人力配送': { fee: 8.0, icon: 'walking', desc: '精准送达，速度较慢' }, '无人机配送': { fee: 5.0, icon: 'drone-alt', desc: '速度最快，需定点取餐' }, '自取': { fee: 0.0, icon: 'store', desc: '时间灵活，免配送费' } },
        DRONE_PICKUP_POINTS: ["中央图书馆停机坪", "天穹体育场A口", "湖心岛补给站", "科研中心-北区平台"],
        specialsPool: { prefixes: ['海盐', '焦糖', '烤椰', '枫糖', '桂花', '杏仁', '薄荷', '樱花', '玫瑰', '白桃', '葡萄', '柑橘', '青柠', '姜撞', '紫薯'], bases: ['拿铁', '冷萃', '美式', '卡布奇诺', '冰摇', '浮云', '奶茶', '气泡水', '乌龙', '冰沙', '酸奶', '特调茶'], decorations: ['芝士奶盖', '水晶冻', '爆珠', '布蕾', '奥利奥碎', '忌廉'] },

        init() {
            this.populateRestaurantData();
            this.DOM = {
                app: document.getElementById('boli-bite-app'),
                title: document.getElementById('bb-title'),
                backButton: document.querySelector('#boli-bite-app .back-button'),
                headerCartIcon: document.getElementById('bb-header-cart-icon'),
                cartBadge: document.getElementById('bb-cart-badge'),
                mainContent: document.querySelector('#boli-bite-app .bb-main-content'),
                listView: document.getElementById('bb-restaurant-list-view'),
                menuView: document.getElementById('bb-menu-view'),
                exhibitionView: document.getElementById('bb-exhibition-view'),
                cartView: document.getElementById('bb-cart-container'),
                checkoutFooter: document.getElementById('bb-checkout-footer'),
            };
            this.initializeUserLocation();
            this.addEventListeners();
            this.renderRestaurantList();
        },

        initializeUserLocation() { const locations = ["中央图书馆", "第一教学楼", "天穹体育场", "未名湖畔", "启真住宿区-A栋", "科研中心-北区"]; this.state.userLocation = locations[Math.floor(Math.random() * locations.length)]; },

        generateSpecialDrink() { const { prefixes, bases, decorations } = this.specialsPool; const base = bases[Math.floor(Math.random() * bases.length)]; const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]; const hasDecoration = Math.random() < 0.4; let name = ''; if (hasDecoration) { const decoration = decorations[Math.floor(Math.random() * decorations.length)]; if (decoration === '芝士奶盖' || decoration === '忌廉' || decoration === '布蕾') { name = prefix + decoration + base; } else if (decoration === '奥利奥碎') { name = prefix + '奥利奥' + base; } else { name = decoration + prefix + base; } } else { name = prefix + base; } const price = Math.floor(Math.random() * (48 - 35 + 1)) + 35; return { name, price }; },

        addEventListeners() {
            this.DOM.app.addEventListener('click', e => {
                const restaurantCard = e.target.closest('.bb-restaurant-card');
                const addToCartBtn = e.target.closest('.add-to-cart-btn');
                const exhibitionReserveBtn = e.target.closest('.exhibition-reserve-btn');
                const cartQtyBtn = e.target.closest('.cart-item-controls button');
                const placeOrderBtn = e.target.closest('#bb-place-order-btn');
                const deliveryOptionBtn = e.target.closest('.option-btn');
                if (restaurantCard) { const id = restaurantCard.dataset.id; const isOrderable = this.RESTAURANT_DATA[id]?.orderable; if (id) isOrderable ? this.showMenu(id) : this.showExhibition(id); }
                else if (addToCartBtn) { this.addToCart(addToCartBtn.dataset.restaurantId, addToCartBtn.dataset.itemId); }
                else if (exhibitionReserveBtn) { const restaurantName = exhibitionReserveBtn.dataset.restaurantName; const command = `[通过BoliBite发送了“${restaurantName}”的用餐预约邮件]`; if(window.PhoneUI) { window.PhoneUI.queueCommand(command); window.PhoneUI.showIslandNotification('<i class="far fa-envelope"></i>', '预约邮件已发送'); } }
                else if (cartQtyBtn) { this.updateCartQuantity(cartQtyBtn.dataset.id, cartQtyBtn.dataset.action); }
                else if (placeOrderBtn) { this.placeOrder(); }
                else if (deliveryOptionBtn) { this.handleDeliverySelection(deliveryOptionBtn.dataset.method); }
            });
            this.DOM.backButton.addEventListener('click', () => this.handleBackNavigation());
            this.DOM.headerCartIcon.addEventListener('click', () => this.showCart());
        },

        handleBackNavigation() {
            if (this.state.currentView === 'cart') { const targetView = this.state.cameToCartFrom || 'list'; this.switchView(targetView, null, true); this.state.cameToCartFrom = null; }
            else if (this.state.currentView !== 'list') { const targetView = this.state.lastNavigatedView || 'list'; this.switchView(targetView, null, true); }
            else { if(window.PhoneUI) window.PhoneUI.navigateBack(); }
        },

        switchView(viewName, restaurantId = null, isNavigatingBack = false) {
            this.DOM.app.querySelectorAll('.bb-view').forEach(v => v.classList.remove('active'));
            const viewMap = { list: this.DOM.listView, menu: this.DOM.menuView, exhibition: this.DOM.exhibitionView, cart: this.DOM.cartView };
            if (viewMap[viewName]) viewMap[viewName].classList.add('active');
            if (!isNavigatingBack && viewName !== 'cart' && this.state.currentView !== viewName) { this.state.lastNavigatedView = this.state.currentView; }
            this.state.currentView = viewName; this.state.currentRestaurantId = restaurantId || (viewName === 'list' ? null : this.state.currentRestaurantId);
            const rData = this.RESTAURANT_DATA[this.state.currentRestaurantId];
            this.DOM.title.textContent = viewName === 'list' ? 'Boli Bite' : (viewName === 'cart' ? '购物车' : (rData?.name || '详情'));
            this.DOM.headerCartIcon.style.visibility = viewName === 'cart' ? 'hidden' : 'visible';
            this.DOM.checkoutFooter.style.display = 'none';
        },

        showRestaurantList() { this.switchView('list', null); },
        showMenu(restaurantId) { this.renderMenu(restaurantId); this.switchView('menu', restaurantId); },
        showExhibition(restaurantId) { this.renderExhibition(restaurantId); this.switchView('exhibition', restaurantId); },
        showCart() {
            if (this.state.currentView !== 'cart') { this.state.cameToCartFrom = this.state.currentView; }
            this.renderCart(); this.switchView('cart');
        },

        renderRestaurantList() { const locationBar = `<div class="bb-location-bar"><i class="fas fa-map-marker-alt"></i>当前位置: <span>${this.state.userLocation}</span></div>`; const categories = { 1: [], 2: [], 3: [], 4: [] }; Object.values(this.RESTAURANT_DATA).forEach(r => (categories[r.category] || []).push(r)); const categoryTitles = { 1: '尊享甄选', 2: '休闲餐厅', 3: '常规简餐', 4: '便利速食' }; let listHtml = ''; for (let i = 1; i <= 4; i++) { if (categories[i].length > 0) { listHtml += `<h2 class="bb-list-category-title">${categoryTitles[i]}</h2>`; categories[i].forEach(r => { listHtml += ` <div class="bb-restaurant-card ${r.orderable ? '' : 'disabled'}" data-id="${r.id}"> <img src="${r.image}" alt="${r.name}" class="bb-restaurant-card-img"> <div class="bb-restaurant-card-info"> <h3>${r.name}<span class="en-name">${r.englishName}</span></h3> ${r.description} ${!r.orderable ? '<span class="tag luxury">仅供预约</span>' : ''} </div> </div>`; }); } } this.DOM.listView.innerHTML = locationBar + `<div class="bb-restaurant-list-padding">${listHtml}</div>`; },

        renderMenu(restaurantId) { const r = this.RESTAURANT_DATA[restaurantId]; if (!r) return; if (r.specials) { r.specials = []; } let headerHtml = `<div class="bb-menu-header-expanded"><img src="${r.image}" class="bb-menu-header-img-bg" alt="${r.name}"><h2>${r.name}</h2>${r.englishName}</div>`; let menuHtml = '<div class="bb-menu-list">'; r.menu.forEach(category => { menuHtml += `<div class="bb-menu-category"><h3>${category.categoryName}</h3>`; category.items.forEach(item => { menuHtml += ` <div class="bb-menu-item"> <div class="bb-menu-item-info"> <h4>${item.name}</h4> <span class="price">¥ ${item.price.toFixed(2)}</span> </div> <button class="add-to-cart-btn" data-restaurant-id="${r.id}" data-item-id="${item.id}"><i class="fas fa-plus"></i></button> </div>`; }); menuHtml += '</div>'; }); if (restaurantId === 'res9') { if (!r.specials) r.specials = []; const specialsCount = Math.floor(Math.random() * 2) + 1; let specialsHtml = '<div class="bb-menu-category"><h3>✨今日特调✨</h3>'; const generatedNames = new Set(); for (let i = 0; i < specialsCount; i++) { let special; do { special = this.generateSpecialDrink(); } while (generatedNames.has(special.name)); generatedNames.add(special.name); const specialItemId = `special_${Date.now()}_${i}`; r.specials.push({ id: specialItemId, name: special.name, price: special.price }); specialsHtml += ` <div class="bb-menu-item"> <div class="bb-menu-item-info"> <h4>${special.name}</h4> <span class="price">¥ ${special.price.toFixed(2)}</span> </div> <button class="add-to-cart-btn" data-restaurant-id="${r.id}" data-item-id="${specialItemId}"><i class="fas fa-plus"></i></button> </div>`; } specialsHtml += '</div>'; menuHtml += specialsHtml; } this.DOM.menuView.innerHTML = headerHtml + menuHtml + '</div>'; },

        renderExhibition(restaurantId) { const r = this.RESTAURANT_DATA[restaurantId]; if (!r || !r.details) return; const ingredients = r.details.specialIngredients.sort(() => 0.5 - Math.random()).slice(0, 3); this.DOM.exhibitionView.innerHTML = ` <div class="bb-exhibition-header"><h2>${r.name}</h2>${r.englishName}</div> <div class="bb-exhibition-content"> <div class="exhibition-section"><h4>餐厅理念</h4>${r.details.history}</div> <div class="exhibition-section"><h4>近日食材赏味</h4><ul class="exhibition-ingredients-list">${ingredients.map(ing => `<li>${ing}</li>`).join('')}</ul></div> </div> <div class="bb-exhibition-footer"><button class="exhibition-reserve-btn" data-restaurant-name="${r.name}"><i class="far fa-envelope"></i> 邮件预约</button></div>`; },

        renderCart() { if (this.state.cart.length === 0) { this.DOM.cartView.innerHTML = `<div id="bb-empty-cart-msg"><i class="fas fa-shopping-basket"></i>购物车是空的</div>`; this.DOM.checkoutFooter.style.display = 'none'; return; } const subtotal = this.state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0); const selectedMethod = this.state.delivery.method; const fee = this.DELIVERY_OPTIONS[selectedMethod].fee; const total = subtotal + fee; let pickupPointHtml = ''; if (selectedMethod === '无人机配送' && this.state.delivery.pickupPoint) { pickupPointHtml = `<div class="summary-row pickup-point"><span><i class="fas fa-map-marker-alt"></i> 取餐点: ${this.state.delivery.pickupPoint}</span></div>`; } const optionsHtml = ` <div class="bb-cart-footer"> <div class="bb-cart-options"> <h4>配送方式</h4> <div class="options-group"> ${Object.entries(this.DELIVERY_OPTIONS).map(([method, details]) => ` <div class="option-btn ${selectedMethod === method ? 'selected' : ''}" data-method="${method}"> <div class="option-btn-header"> <span><i class="fas fa-${details.icon}"></i> ${method}</span> <span>+ ¥${details.fee.toFixed(2)}</span> </div> <div class="option-btn-desc">${details.desc}</div> </div>`).join('')} </div> </div> <div class="bb-cart-summary"> <div class="summary-row"><span>小计</span><span>¥ ${subtotal.toFixed(2)}</span></div> <div class="summary-row"><span>配送费</span><span>¥ ${fee.toFixed(2)}</span></div> ${pickupPointHtml} <div class="summary-row total"><span>总计</span><span>¥ ${total.toFixed(2)}</span></div> </div> </div>`; this.DOM.cartView.innerHTML = `<div id="bb-cart-list">` + this.state.cart.map(item => ` <div class="cart-item"> <div class="cart-item-info"><h5>${item.name}</h5>¥ ${item.price.toFixed(2)}</div> <div class="cart-item-controls"> <button data-id="${item.id}" data-action="decrease"><i class="fas fa-minus"></i></button> <span>${item.quantity}</span> <button data-id="${item.id}" data-action="increase"><i class="fas fa-plus"></i></button> </div> </div>`).join('') + `</div>` + optionsHtml; this.DOM.checkoutFooter.querySelector('.total-cost').textContent = `¥ ${total.toFixed(2)}`; this.DOM.checkoutFooter.querySelector('#bb-place-order-btn').disabled = window.BoliCampusCardApp.state.balance < total; this.DOM.checkoutFooter.style.display = 'flex'; },

        addToCart(restaurantId, itemId) { if (this.state.cart.length > 0 && this.state.cart[0].restaurantId !== restaurantId) { if (!confirm('您的购物车里有另一家餐厅的商品，要清空购物车并添加新商品吗？')) return; this.state.cart = []; this.state.delivery = { method: '无人机配送', pickupPoint: null }; } const restaurant = this.RESTAURANT_DATA[restaurantId]; if (!restaurant) return; let menuItem = restaurant.menu.flatMap(c => c.items).find(i => i.id === itemId); if (!menuItem && restaurant.specials) { menuItem = restaurant.specials.find(i => i.id === itemId); } if (!menuItem) { console.error("Item not found:", itemId); return; } const existingItem = this.state.cart.find(item => item.id === itemId); if (existingItem) { existingItem.quantity++; } else { this.state.cart.push({ ...menuItem, quantity: 1, restaurantId }); } this.updateCartBadge(); if(window.PhoneUI) window.PhoneUI.showIslandNotification('<i class="fas fa-check" style="color:#FFF"></i>', '已加入购物车'); },

        updateCartQuantity(itemId, action) { const itemIndex = this.state.cart.findIndex(i => i.id === itemId); if (itemIndex > -1) { if (action === 'increase') this.state.cart[itemIndex].quantity++; else if (action === 'decrease') { this.state.cart[itemIndex].quantity--; if (this.state.cart[itemIndex].quantity <= 0) this.state.cart.splice(itemIndex, 1); } } this.updateCartBadge(); this.renderCart(); },

        updateCartBadge() { const count = this.state.cart.reduce((sum, item) => sum + item.quantity, 0); this.DOM.cartBadge.textContent = count; this.DOM.headerCartIcon.style.display = 'flex'; this.DOM.cartBadge.style.display = count > 0 ? 'grid' : 'none'; },

        handleDeliverySelection(method) { this.state.delivery.method = method; this.state.delivery.pickupPoint = null; if (method === '无人机配送') { const promptText = "请选择无人机取餐点：\n" + this.DRONE_PICKUP_POINTS.map((p, i) => `${i + 1}. ${p}`).join('\n'); const choice = prompt(promptText, "1"); const choiceIndex = parseInt(choice, 10) - 1; if (choiceIndex >= 0 && choiceIndex < this.DRONE_PICKUP_POINTS.length) { this.state.delivery.pickupPoint = this.DRONE_PICKUP_POINTS[choiceIndex]; } else { this.state.delivery.pickupPoint = this.DRONE_PICKUP_POINTS[0]; alert("选择无效，已为您指定默认取餐点。"); } } this.renderCart(); },

        placeOrder() {
            if (this.state.cart.length === 0) return;
            const subtotal = this.state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const deliveryMethod = this.state.delivery.method;
            const fee = this.DELIVERY_OPTIONS[deliveryMethod].fee;
            const total = subtotal + fee;

            if (window.BoliCampusCardApp.state.balance < total) {
                alert(`校园卡余额不足！\n需要 ¥${total.toFixed(2)}，余额 ¥${window.BoliCampusCardApp.state.balance.toFixed(2)}`);
                return;
            }

            if (deliveryMethod === '无人机配送' && !this.state.delivery.pickupPoint) {
                alert("请先为无人机配送选择一个取餐点！");
                return;
            }

            const restaurantName = this.RESTAURANT_DATA[this.state.cart[0].restaurantId].name;
            const itemDetails = this.state.cart.map(item => `${item.name} x${item.quantity}`).join(', ');
            let deliveryDetails = `使用${deliveryMethod}。`;
            if (deliveryMethod === '无人机配送') {
                deliveryDetails = `使用无人机配送，取餐点：${this.state.delivery.pickupPoint}。`;
            }

            const descriptiveCommand = `[通过BoliBite订购：${restaurantName}的“${itemDetails}”。共计 ¥${total.toFixed(2)}，${deliveryDetails}并已通过校园卡支付]`;

            // Queue a special command with payment info
            const fullCommand = `[CMD_PAY:${total.toFixed(2)}] ${descriptiveCommand}`;
            if(window.PhoneUI) {
                window.PhoneUI.queueCommand(fullCommand);
                window.PhoneUI.showIslandNotification('<i class="fas fa-receipt"></i>', '订单已提交');
            }

            this.state.cart = [];
            this.state.delivery = { method: '无人机配送', pickupPoint: null };
            this.updateCartBadge();
            this.showRestaurantList();
        },

        populateRestaurantData() { this.RESTAURANT_DATA = { 'res1': { id:'res1', name: '兰亭轩', englishName: 'Orchid Pavilion', image:'https://files.catbox.moe/8qrixm.jpeg', category: 1, description: '现代手法诠释中华古典菜系', orderable: false, details:{ history: '兰亭轩，如其名，是一处追求私密与典雅的现代中餐秘境。我们以四季流转为灵感，遍选华夏风物，用精湛的现代烹饪技艺，重新解构并呈现中华古典菜系的深厚底蕴。每一道菜，都是一首可以品尝的诗。', specialIngredients: ['东海大黄鱼', '云南松茸', '五年陈金华火腿', '手剥太湖河虾仁', '潮汕狮头鹅肝'] } }, 'res2': { id:'res2', name: '滝月', englishName: 'Ryūgetsu', image:'https://files.catbox.moe/f6duw6.jpeg', category: 1, description: '顶级怀石料理与Omakase', orderable: false, details:{ history: '滝，为瀑布；月，为天心。滝月，意在喧嚣中觅得一方静谧，于极简禅意间体验食材的本真之味。由特聘名厨主理，不设菜单，仅凭当日最新鲜的食材，为您呈现独一无二的顶级怀石与Omakase体验。', specialIngredients: ['北海道马粪海胆', '蓝鳍金枪鱼大腹', '长崎星鳗', '静冈蜜瓜', 'A5级神户牛'] }}, 'res3': { id:'res3', name: '冬园', englishName: "Le Jardin d'Hiver", image:'https://files.catbox.moe/0ftr7j.jpeg', category: 1, description: '俯瞰湖景的高级法餐厅', orderable: false, details:{ history: '于冬日花园之中，瞰未明湖光潋滟。冬园将经典法式大餐的浪漫与优雅，融入这片独特的校园景致。我们拥有丰富的藏酒，并以传统法餐的严谨与创意，为您打造一场视觉与味觉的双重盛宴。', specialIngredients: ['法国芬迪克莱尔生蚝', '布列塔尼蓝龙虾', '佩里戈尔黑松露', '法式AOC级黄油', '露杰鹅肝'] }}, 'res4': { id:'res4', name: '社区食荟', englishName: 'The Commons', image:'https://files.catbox.moe/1lfzsq.jpeg', category: 2, description: '高品质社区餐饮', orderable: true, menu: [ {categoryName: '主厨推荐', items: [ { id: 'c1', name: '时令主厨沙拉', price: 68 }, { id: 'c2', name: '炙烤三文鱼配芦笋', price: 128 }, { id: 'c3', name: '今日例汤', price: 35 } ]}, {categoryName: '意面与饭', items: [ { id: 'c4', name: '奶油蘑菇意面', price: 78 }, { id: 'c5', name: '西班牙海鲜烩饭', price: 138 } ]}, {categoryName: '饮品', items: [ { id: 'c6', name: '鲜榨橙汁', price: 32 }, { id: 'c7', name: '苏打水', price: 20 } ]} ]}, 'res5': { id:'res5', name: '萨瓦罗尼的厨房', englishName: 'Savaroni\'s Kitchen', image:'https://files.catbox.moe/zfapi6.jpeg', category: 2, description: '家庭式意大利餐厅', orderable: true, menu: [ {categoryName: '开胃前菜', items: [ { id: 'ita0', name: '意式火腿蜜瓜', price: 78 } ]}, {categoryName: '经典主食', items:[ { id: 'ita1', name: '玛格丽特披萨', price: 98 }, { id: 'ita2', name: '肉酱千层面', price: 88 } ]}, {categoryName: '甜品', items:[ { id: 'ita3', name: '提拉米苏', price: 45 } ]} ]}, 'res6': { id:'res6', name: '熔炉扒房', englishName: 'The Foundry Grill', image:'https://files.catbox.moe/bsb9tt.png', category: 2, description: '现代美式烧烤', orderable: true, menu: [ {categoryName: '招牌烤肉', items:[ { id: 'grill1', name: '经典牛肉汉堡', price: 95 }, { id: 'grill2', name: 'BBQ猪肋排', price: 158 } ]}, {categoryName: '小食', items:[ { id: 'grill3', name: '香脆洋葱圈', price: 48 }, { id: 'grill4', name: '芝士薯条', price: 55} ]} ]}, 'res9': { id:'res9', name: '中心咖啡', englishName: ' The Hub Café', image:'https://files.catbox.moe/lo4zqz.jpeg', category: 2, description: '校内连锁咖啡厅', orderable: true, menu: [ { categoryName: '精品手冲', items: [ { id: 'cafe1', name: '耶加雪菲', price: 45 }, { id: 'cafe2', name: '云南小柑橘', price: 42 } ] }, { categoryName: '意式咖啡', items: [ { id: 'cafe3', name: '美式咖啡', price: 28 }, { id: 'cafe4', name: '拿铁', price: 35 }, { id: 'cafe7', name: '卡布奇诺', price: 35 } ] }, { categoryName: '佐餐甜品', items: [ { id: 'cafe5', name: '可颂面包', price: 22 }, { id: 'cafe6', name: '巴斯克蛋糕', price: 38 } ] } ]}, 'res12': { id:'res12', name: '即刻达', englishName: 'Grab&Go', image:'https://files.catbox.moe/42dkz4.jpeg', category: 4, description: '24小时无人便利店', orderable: true, menu: [ { categoryName: '餐食饮品', items: [ { id: 'go1', name: '三明治组合', price: 25 }, { id: 'go2', name: '瓶装乌龙茶', price: 8 }, { id: 'go3', name: '进口气泡水', price: 12 } ] }, { categoryName: '零食', items: [ { id: 'go6', name: '能量棒', price: 15 }, { id: 'go7', name: '薯片', price: 9 } ] }, { categoryName: '生活用品', items: [ { id: 'go4', name: '速干毛巾', price: 35 }, { id: 'go5', name: '便携牙具套装', price: 18 } ] } ]}, 'res7': { id:'res7', name: '湄公河畔', englishName: 'Mekong Riverside', image:'https://files.catbox.moe/90z4jw.jpeg', category: 2, description: '东南亚融合料理', orderable: true, menu: [{categoryName: '特色菜', items:[ { id: 'sea1', name: '冬阴功汤', price: 78 }, { id: 'sea2', name: '青咖喱鸡', price: 85 } ]}, {categoryName: '主食', items:[ { id: 'sea3', name: '菠萝海鲜炒饭', price: 68 } ]}]}, 'res8': { id:'res8', name: '光与影', englishName: 'Luz y Sombra', image:'https://files.catbox.moe/dxhzfg.jpeg', category: 2, description: '西班牙Tapas小馆', orderable: true, menu: [{categoryName: 'Tapas', items:[ { id: 'tapas1', name: '蒜香橄榄油虾', price: 68 }, { id: 'tapas2', name: '伊比利亚火腿', price: 128 }, { id: 'tapas3', name: '土豆烘蛋', price: 45 } ]}]}, 'res10': { id:'res10', name: '四方食街', englishName: 'Quad Food Street', image:'https://files.catbox.moe/hxpqyr.jpeg', category: 3, description: '国际菜品美食广场', orderable: true, menu: [{categoryName: '人气档口', items:[ { id: 'q1', name: '麻辣香锅', price: 55 }, { id: 'q2', name: '石锅拌饭', price: 48 }, { id: 'q3', name: '广式烧腊饭', price: 42 } ]}]}, 'res11': { id:'res11', name: '萬龍面家', englishName: 'Wanlong Noodles', image:'https://files.catbox.moe/029scj.jpeg', category: 3, description: '亚洲特色面食', orderable: true, menu: [{categoryName: '招牌面食', items:[ { id: 'noodle1', name: '红烧牛肉面', price: 45 }, { id: 'noodle2', name: '日式豚骨拉面', price: 52 } ]}, {categoryName: '小食', items:[ { id: 'noodle3', name: '煎饺', price: 25 } ]}]}, }; },
    };

    // 将模块挂载到window上
    window.BoliBiteApp = BoliBiteApp;

})();
