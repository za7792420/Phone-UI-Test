// index.js
SillyTavern.Foundry.registerExtension({
  name: 'phone-beautifier',
  displayName: '手机美化',
  version: '1.0.0',
  author: '插件助手',

  async onMessageRendered(message) {
    const messageText = message.text;
    const messageElement = message.element;

    // 检查消息是否包含触发器 `[phone-ui]`
    // 为兼容流式输出，我们会多次检查
    if (messageText.includes('[phone-ui]') && !messageElement.querySelector('#phone-beautifier-root')) {
      // 动态加载一次FontAwesome，避免重复加载
      if (!document.querySelector('#fa-styles-for-phone')) {
        const fa = document.createElement('link');
        fa.id = 'fa-styles-for-phone';
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(fa);
      }

      // 为了确保完全渲染，我们给一点点延迟
      await new Promise(resolve => setTimeout(resolve, 100));

      const mesTextElement = messageElement.querySelector('.mes_text');
      if (!mesTextElement) return;

      // 隐藏触发器文本
      const p = Array.from(mesTextElement.querySelectorAll('p')).find(p => p.textContent.includes('[phone-ui]'));
      if (p) {
        p.style.display = 'none';
      }

      // 注入CSS和HTML
      SillyTavern.Foundry.inject('phone-beautifier', {
        css: ['style.css'],
        html: ['inject.html'],
        into: mesTextElement,
        callback: (element) => {
          console.log('[手机美化]：UI注入成功。下一步将添加交互逻辑。');
          // 注意：现在所有交互都是无效的，因为我们还没有加载JavaScript。
        }
      });
    }
  },
});
