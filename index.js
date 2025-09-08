(function () {
    'use strict';

    // 定义需要加载的脚本及其路径
    const scriptsToLoad = [
        'extensions/ST-Phone-UI/js/app.campus-card.js',
        'extensions/ST-Phone-UI/js/app.boli-bite.js',
        'extensions/ST-Phone-UI/js/core.js'
    ];

    // 创建一个函数来动态加载脚本
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // 防止重复加载
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    // 顺序加载所有脚本
    async function loadAllScripts() {
        for (const src of scriptsToLoad) {
            await loadScript(src);
        }
    }

    // 注册SillyTavern扩展
    registerExtension({
        name: 'PhoneUI',
        display_name: '手机美化UI v19',
        author: '{{user}}',
        version: '1.0.0',
        onload: async () => {
            try {
                // 等待所有脚本加载完毕
                await loadAllScripts();
                // 确保PhoneUI对象存在再执行初始化
                if (window.PhoneUI && typeof window.PhoneUI.init === 'function') {
                    window.PhoneUI.init();
                    console.log('PhoneUI and all its modules loaded successfully.');
                } else {
                    throw new Error('PhoneUI core failed to define itself on the window object.');
                }
            } catch (error) {
                console.error("Failed to load PhoneUI extension:", error);
                alert("手机UI插件加载失败，请检查控制台获取更多信息。");
            }
        },
        onunload: () => {
             if (window.PhoneUI && typeof window.PhoneUI.cleanup === 'function') {
                window.PhoneUI.cleanup();
            }
        },
    });

})();
