// Chat Manager - Chat functionality and emoji support
class ChatManager {
    constructor(app) {
        this.app = app;
        this.messages = [];
        this.isDesktop = window.innerWidth > 768;
        this.clientId = Math.random().toString(36).substr(2, 9); // Unique per tab
        this.emojiList = [
            '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
            '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
            '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
            '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
            '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
            '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
            '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦',
            '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
            '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿',
            '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖',
            '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
            '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
            '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
            '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
            '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
            '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
            '👄', '💋', '🩸', '👤', '👥', '🫂', '👶', '👧', '🧒', '👦',
            '👩', '🧑', '👨', '👩‍🦱', '🧑‍🦱', '👨‍🦱', '👩‍🦰', '🧑‍🦰', '👨‍🦰', '👱‍♀️',
            '👱', '👱‍♂️', '👩‍🦳', '🧑‍🦳', '👨‍🦳', '👩‍🦲', '🧑‍🦲', '👨‍🦲', '🧔', '👵',
            '🧓', '👴', '👲', '👳‍♀️', '👳', '👳‍♂️', '🧕', '👮‍♀️', '👮', '👮‍♂️'
        ];
        this._networkChatListenerAdded = false; // Prevent duplicate listeners
        this.init();
    }
    
    init() {
        this.setupEmojiPickers();
        this.setupEventListeners();
        this.updateLayout();

        // Listen for window resize
        window.addEventListener('resize', () => {
            this.isDesktop = window.innerWidth > 768;
            this.updateLayout();
        });

        // Register network chat event handler only once
        if (this.app.networkManager && !this._networkChatListenerAdded) {
            this.app.networkManager.on('chat', (data) => {
                // Only add message if not from this client
                if (data.clientId !== this.clientId) {
                    this.addMessage(data);
                }
            });
            this._networkChatListenerAdded = true;
        }

        console.log('ChatManager initialized with emoji buttons:', 
            document.getElementById('desktopEmojiBtn'), 
            document.getElementById('mobileEmojiBtn'));
    }
    
    setupEventListeners() {
        // Desktop chat
    const desktopInput = document.getElementById('desktopChatInput');
    const desktopSend = document.getElementById('desktopSendBtn');
    const desktopEmoji = document.getElementById('desktopEmojiBtn');

    if (desktopInput && desktopSend) {
        desktopInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(desktopInput.value, 'desktop');
            }
        });

        desktopSend.addEventListener('click', () => {
            this.sendMessage(desktopInput.value, 'desktop');
        });
    }

    if (desktopEmoji) {
        desktopEmoji.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleEmojiPicker('desktop');
        });
    } else {
        console.log('Desktop emoji button not found');
    }

    // Mobile chat
    const mobileInput = document.getElementById('mobileChatInput');
    const mobileSend = document.getElementById('mobileSendBtn');
    const mobileEmoji = document.getElementById('mobileEmojiBtn');

    if (mobileInput && mobileSend) {
        mobileInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(mobileInput.value, 'mobile');
            }
        });

        mobileSend.addEventListener('click', () => {
            this.sendMessage(mobileInput.value, 'mobile');
        });
    }

    if (mobileEmoji) {
        mobileEmoji.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleEmojiPicker('mobile');
        });
    } else {
        console.log('Mobile emoji button not found');
    }

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-btn')) {
            this.closeEmojiPickers();
        }
    });
}
    
    setupEmojiPickers() {
    // Define emoji categories
    const emojiCategories = {
        smileys: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳'],
        gestures: [
            '👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪',
            '🦾','🦿','🦵','🦶','👂','🦻','👃','🧠',
            '🖐️','✋','🤚','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙',
            '👈','👉','👆','🖕','👇','☝️'
        ],
        animals: ['🐵','🐒','🦍','🦧','🐶','🐕','🦮','🐕‍🦺','🐩','🐺','🦊','🦝','🐱','🐈','🐈‍⬛','🦁','🐯','🐅','🐆','🐴','🐎','🦄','🦓','🦌','🐮','🐂','🐃','🐄','🐷','🐖','🐗','🐽','🐏','🐑','🐐','🐪','🐫','🦙','🦒','🐘','🦣','🦏','🦛','🐭','🐁','🐀','🐹','🐰','🐇','🐿','🦫','🦔','🦇','🐻','🐻‍❄️','🐨','🐼','🦥','🦦','🦨','🦘','🦡','🐾'],
        misc: ['🎲','🏆','💡','🤖','💯','🎯','💣','🌪','🪨','🔮','⌛','🕳','🐇','💀','⚰','🪦','🐍','🐢','💨','🧃','🍿','🐸','🍵','🪞','👀','🧽','🗑','🧻','🪵','🚽','🧎‍♂','🎁','🚶','👑','🏹','🛡']
    };

    ['desktop', 'mobile'].forEach(platform => {
        const picker = document.getElementById(platform + 'EmojiPicker');
        if (!picker) return;

        // Clear picker
        picker.innerHTML = '';

        // Create tabs
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'emoji-tabs';
        Object.keys(emojiCategories).forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = 'emoji-tab' + (idx === 0 ? ' active' : '');
            btn.setAttribute('data-cat', cat);
            btn.textContent = emojiCategories[cat][0];
            tabsDiv.appendChild(btn);
        });
        picker.appendChild(tabsDiv);

        // Create emoji list container
        const emojiListDiv = document.createElement('div');
        emojiListDiv.className = 'emoji-list';
        picker.appendChild(emojiListDiv);

        // Tab logic
        const tabs = tabsDiv.querySelectorAll('.emoji-tab');
        function showCategory(cat) {
            tabs.forEach(t => t.classList.remove('active'));
            tabsDiv.querySelector(`[data-cat="${cat}"]`).classList.add('active');
            emojiListDiv.innerHTML = emojiCategories[cat].map(emoji =>
                `<button class="emoji-option" data-emoji="${emoji}">${emoji}</button>`
            ).join('');
        }
        tabs.forEach(tab => {
            tab.onclick = () => showCategory(tab.getAttribute('data-cat'));
        });

        // Default to first tab
        showCategory(Object.keys(emojiCategories)[0]);

        // Emoji click
        emojiListDiv.onclick = (e) => {
            if (e.target.classList.contains('emoji-option')) {
                const emoji = e.target.dataset.emoji;
                this.insertEmoji(emoji, platform);
                // Do NOT close pickers here, insertEmoji already does
                e.stopPropagation();
            }
        };
    });
}
    
    sendMessage(content, platform = 'desktop') {
        if (!content || !content.trim()) return;

        const message = {
            content: content.trim(),
            player: this.app.getPlayerName(),
            timestamp: Date.now(),
            platform,
            clientId: this.clientId
        };

        // Only add message locally if not in a networked room
        if (!(this.app.networkManager && this.app.networkManager.getCurrentRoom())) {
            this.addMessage(message);
        }

        if (this.app.networkManager && this.app.networkManager.getCurrentRoom()) {
            this.app.networkManager.sendChatMessage({ ...message });
        }

        this.clearInput(platform);
        this.app.playSound('click');
    }
    
    addMessage(messageData) {
        // Prevent duplicates by timestamp and clientId
        if (this.messages.some(
            m => m.timestamp === (messageData.timestamp || Date.now()) &&
                 m.clientId === messageData.clientId
        )) {
            return;
        }

        const message = {
            content: messageData.message || messageData.content,
            player: messageData.player,
            timestamp: messageData.timestamp || Date.now(),
            isOwn: messageData.player === this.app.getPlayerName(),
            clientId: messageData.clientId
        };

        this.messages.push(message);

        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }

        this.renderMessages();
        this.scrollToBottom();

        if (!this.isDesktop && !this.isChatVisible()) {
            this.showChatNotification();
        }
    }
    
    renderMessages() {
        const desktopContainer = document.getElementById('desktopChatMessages');
        const mobileContainer = document.getElementById('mobileChatMessages');
        
        const messageHTML = this.messages.map(msg => this.createMessageHTML(msg)).join('');
        
        if (desktopContainer) {
            desktopContainer.innerHTML = messageHTML;
        }
        if (mobileContainer) {
            mobileContainer.innerHTML = messageHTML;
        }
    }
    
    createMessageHTML(message) {
        const time = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const messageClass = message.isOwn ? 'own-message' : 'other-message';
        const playerName = message.isOwn ? 'You' : message.player;
        
        return `
            <div class="chat-message ${messageClass}">
                <div class="message-header">
                    <span class="message-player">${this.escapeHtml(playerName)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.formatMessageContent(message.content)}</div>
            </div>
        `;
    }
    
    formatMessageContent(content) {
        // Basic emoji rendering and text formatting
        return this.escapeHtml(content)
            .replace(/:\)/g, '😊')
            .replace(/:\(/g, '😢')
            .replace(/:D/g, '😃')
            .replace(/;-?\)/g, '😉')
            .replace(/<3/g, '❤️')
            .replace(/:\|/g, '😐')
            .replace(/:P/g, '😛')
            .replace(/:o/gi, '😮')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>') // *italic*
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // **bold**
    }
    
    insertEmoji(emoji, platform) {
        const input = platform === 'desktop' 
            ? document.getElementById('desktopChatInput')
            : document.getElementById('mobileChatInput');
            
        if (input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const before = input.value.substring(0, start);
            const after = input.value.substring(end);
            
            input.value = before + emoji + after;
            input.focus();
            input.setSelectionRange(start + emoji.length, start + emoji.length);
        }
        
        this.closeEmojiPickers();
    }
    
    toggleEmojiPicker(platform) {
        const picker = platform === 'desktop'
            ? document.getElementById('desktopEmojiPicker')
            : document.getElementById('mobileEmojiPicker');
            
        if (picker) {
            const isVisible = !picker.classList.contains('hidden');
            this.closeEmojiPickers();
            
            if (!isVisible) {
                // Always re-render emoji picker content when opening
                this.setupEmojiPickers();
                picker.classList.remove('hidden');
            }
        }
    }
    
    closeEmojiPickers() {
        const pickers = document.querySelectorAll('.emoji-picker');
        pickers.forEach(picker => picker.classList.add('hidden'));
    }
    
    clearInput(platform) {
        const input = platform === 'desktop'
            ? document.getElementById('desktopChatInput')
            : document.getElementById('mobileChatInput');
            
        if (input) {
            input.value = '';
        }
    }
    
    scrollToBottom() {
        const containers = [
            document.getElementById('desktopChatMessages'),
            document.getElementById('mobileChatMessages')
        ];
        
        containers.forEach(container => {
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        });
    }
    
    isChatVisible() {
        if (this.isDesktop) {
            return true; // Chat is always visible on desktop
        } else {
            const drawer = document.getElementById('mobileChatDrawer');
            return drawer && !drawer.classList.contains('hidden');
        }
    }
    
    showChatNotification() {
        // Add notification badge to mobile chat button
        const chatBtn = document.getElementById('mobileChatBtn');
        if (chatBtn && !chatBtn.classList.contains('has-notification')) {
            chatBtn.classList.add('has-notification');
            chatBtn.setAttribute('data-notification', '💬');
        }
    }
    
    clearChatNotification() {
        const chatBtn = document.getElementById('mobileChatBtn');
        if (chatBtn) {
            chatBtn.classList.remove('has-notification');
            chatBtn.removeAttribute('data-notification');
        }
    }
    
    updateLayout() {
        // Update layout based on screen size
        if (this.isDesktop) {
            this.clearChatNotification();
        }
    }
    
    // System Messages
    addSystemMessage(content, type = 'info') {
        const message = {
            content,
            player: 'System',
            timestamp: Date.now(),
            isOwn: false,
            isSystem: true,
            type
        };
        
        this.addMessage(message);
    }
    
    // Player joined/left messages
    playerJoined(playerName) {
        this.addSystemMessage(`🚌 ${playerName} joined the room`, 'join');
    }
    
    playerLeft(playerName) {
        this.addSystemMessage(`🚪 ${playerName} left the room`, 'leave');
    }
    
    gameStarted() {
        this.addSystemMessage('🎮 Game started! Good luck!', 'game');
    }
    
    gameEnded(winner) {
        const message = winner 
            ? `🎉 Game over! ${winner} wins!`
            : '🤝 Game ended in a tie!';
        this.addSystemMessage(message, 'game');
    }
    
    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Clear all messages
    clearMessages() {
        this.messages = [];
        this.renderMessages();
    }
    
    // Get message count
    getMessageCount() {
        return this.messages.length;
    }
}