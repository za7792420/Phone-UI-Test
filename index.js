// index.js

// 顶级日志：如果这个信息在控制台出现，说明SillyTavern至少加载了这个文件。
console.log('[手机美化] index.js 文件已加载。');

SillyTavern.Foundry.registerExtension({
  name: 'phone-beautifier',
  displayName: '手机美化',
  version: '1.0.1', // 升级版本号以示区分
  author: '插件助手',

  // 这个事件在插件被加载时触发
  onLoad() {
    console.log('[手机美化] 插件 onLoad 事件已触发。');
  },

  async onMessageRendered(message) {
    // 每次有消息渲染时，都会打印这条日志
    console.log(`[手机美化] 正在检查消息 #${message.id}，内容: "${message.text.substring(0, 30)}..."`);

    const messageText = message.text;
    const messageElement = message.element;

    // 检查是否包含触发词
    if (messageText.includes('[phone-ui]')) {
      console.log(`[手机美化] 在消息 #${message.id} 中发现触发词 [phone-ui]`);

      // 防止对同一个消息重复注入
      if (messageElement.querySelector('#phone-beautifier-root')) {
          console.log(`[手机美化] 消息 #${message.id} 中已存在UI，跳过注入。`);
          return;
      }

      console.log(`[手机美化] 准备向消息 #${message.id} 注入UI...`);

      // 动态加载 FontAwesome
      if (!document.querySelector('#fa-styles-for-phone')) {
          const fa = document.createElement('link');
          fa.id = 'fa-styles-for-phone';
          fa.rel = 'stylesheet';
          fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
          document.head.appendChild(fa);
          console.log('[手机美化] FontAwesome CSS 已加载。');
      }

      // 为渲染稳定性增加一个微小的延迟
      await new Promise(resolve => setTimeout(resolve, 50));

      const mesTextElement = messageElement.querySelector('.mes_text');
      if (!mesTextElement) {
          console.error(`[手机美化] 错误：在消息 #${message.id} 中未找到 .mes_text 元素！`);
          return;
      }

      // 隐藏包含触发词的段落
      const p = Array.from(mesTextElement.querySelectorAll('p')).find(p => p.textContent.includes('[phone-ui]'));
      if (p) {
          p.style.display = 'none';
          console.log(`[手机美化] 已隐藏包含触发词的  元素。`);
      } else {
          console.warn(`[手机美化] 警告：未找到包含 '[phone-ui]' 的  元素来隐藏。`);
      }

      // 注入CSS和HTML
      SillyTavern.Foundry.inject('phone-beautifier', {
          css: ['style.css'],
          html: ['inject.html'],
          into: mesTextElement,
          callback: (element) => {
              console.log(`[手机美化] UI成功注入到消息 #${message.id}！这是最后一步。`);
          }
      });
    }
  },
});
