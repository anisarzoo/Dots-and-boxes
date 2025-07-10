// Main JavaScript - App initialization and screen management
class DotsAndBoxesApp {
    constructor() {
        this.currentScreen = 'homeScreen';
        this.gameInstance = null;
        this.networkManager = null;
        this.uiManager = null;
        this.chatManager = null;
        this.sounds = {};
        this.settings = {
            soundEnabled: true,
            theme: 'greenboard'
        };

        this.init();
    }

    init() {
        this.loadSettings();
        this.applyTheme();
        this.initializeAudio();
        this.bindEvents();
        this.initializeManagers();
        this.checkUrlHash();
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('dotsAndBoxesSettings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
    }

    saveSettings() {
        localStorage.setItem('dotsAndBoxesSettings', JSON.stringify(this.settings));
    }

    applyTheme() {
        document.body.className = `theme-${this.settings.theme}`;
        const themeButtons = document.querySelectorAll('#themeToggle, #themeToggleHome, #mobileThemeBtn');
        themeButtons.forEach(btn => {
            if (btn) {
                btn.setAttribute('data-theme', this.settings.theme);
            }
        });
    }

    toggleTheme() {
        this.settings.theme = this.settings.theme === 'greenboard' ? 'whiteboard' : 'greenboard';
        this.applyTheme();
        this.saveSettings();
        this.playSound('click');
    }

    initializeAudio() {
        this.sounds = {
            click: document.getElementById('clickSound'),
            chalk: document.getElementById('chalkSound'),
            marker: document.getElementById('markerSound'),
            win: document.getElementById('winSound'),
            draw: document.getElementById('drawSound')
        };
        Object.values(this.sounds).forEach(sound => {
            if (sound) {
                sound.volume = 0.5;
            }
        });
        this.updateSoundButton();
    }

    playSound(soundName) {
        if (!this.settings.soundEnabled) return;
        const sound = this.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    toggleSound() {
        this.settings.soundEnabled = !this.settings.soundEnabled;
        this.updateSoundButton();
        this.saveSettings();
        this.playSound('click');
    }

    updateSoundButton() {
        const soundButtons = document.querySelectorAll('#soundToggle, #mobileSoundBtn');
        soundButtons.forEach(btn => {
            if (btn) {
                btn.textContent = this.settings.soundEnabled ? '🔊' : '🔇';
                btn.setAttribute('title', this.settings.soundEnabled ? 'Mute Sound' : 'Enable Sound');
            }
        });
    }

    bindEvents() {
        this.bindHomeEvents();
        this.bindNavigationEvents();
        this.bindToggleEvents();
        this.bindModalEvents();
        this.bindSetupEvents();
        this.bindMobileEvents();
    }

    bindHomeEvents() {
        const playerNameInput = document.getElementById('playerName');
        const modeButtons = document.querySelectorAll('.mode-btn');
        if (playerNameInput) {
            playerNameInput.addEventListener('input', (e) => {
                const hasName = e.target.value.trim().length > 0;
                modeButtons.forEach(btn => {
                    btn.disabled = !hasName;
                });
            });
            playerNameInput.addEventListener('input', (e) => {
                const name = e.target.value.trim();
                const localPlayer1 = document.getElementById('localPlayer1');
                if (localPlayer1 && name) {
                    localPlayer1.value = name;
                }
            });
        }
        document.getElementById('localGameBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.showScreen('localSetupScreen');
        });
        document.getElementById('createRoomBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.showScreen('createRoomScreen');
        });
        document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.showScreen('joinRoomScreen');
        });
        document.getElementById('quickMatchBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.showScreen('quickMatchScreen');
            this.startQuickMatch();
        });
    }

    bindNavigationEvents() {
        document.querySelectorAll('.home-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.playSound('click');
                if (this.gameInstance && this.gameInstance.gameState === 'playing') {
                    this.showConfirmModal(
                        'Are you sure you want to leave class? Your game progress will be erased.',
                        () => this.goHome()
                    );
                } else {
                    this.goHome();
                }
            });
        });
        document.getElementById('mobileHomeBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.playSound('click');
            if (this.gameInstance && this.gameInstance.gameState === 'playing') {
                this.showConfirmModal(
                    'Are you sure you want to leave class? Your game progress will be erased.',
                    () => this.goHome()
                );
            } else {
                this.goHome();
            }
        });
    }

    bindToggleEvents() {
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('themeToggleHome')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('mobileThemeBtn')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('soundToggle')?.addEventListener('click', () => this.toggleSound());
        document.getElementById('mobileSoundBtn')?.addEventListener('click', () => this.toggleSound());
    }

    bindModalEvents() {
        document.getElementById('rulesBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.showModal('rulesModal');
        });
        document.getElementById('mobileRulesBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.showModal('rulesModal');
        });
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playSound('click');
                this.hideAllModals();
            });
        });
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.playSound('click');
                    this.hideAllModals();
                }
            });
        });
        document.getElementById('confirmYes')?.addEventListener('click', () => {
            this.playSound('click');
            this.hideAllModals();
            if (this.pendingConfirmAction) {
                this.pendingConfirmAction();
                this.pendingConfirmAction = null;
            }
        });
        document.getElementById('confirmNo')?.addEventListener('click', () => {
            this.playSound('click');
            this.hideAllModals();
            this.pendingConfirmAction = null;
        });
    }

    bindSetupEvents() {
        this.bindLocalSetupEvents();
        this.bindRoomEvents();
        this.bindJoinEvents();
    }

    bindLocalSetupEvents() {
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playSound('click');
                document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const count = parseInt(btn.dataset.count);
                this.updatePlayerInputs(count);
            });
        });
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playSound('click');
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        document.getElementById('startLocalGame')?.addEventListener('click', () => {
            this.playSound('click');
            this.startLocalGame();
        });
    }

    bindRoomEvents() {
        document.getElementById('createRoom')?.addEventListener('click', () => {
            this.playSound('click');
            this.createRoom();
        });
        document.getElementById('copyCode')?.addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('roomCodeDisplay')?.textContent || '');
        });
        document.getElementById('copyLink')?.addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('inviteLink')?.textContent || '');
        });
        document.getElementById('startRoomGame')?.addEventListener('click', () => {
            this.playSound('click');
            this.startRoomGame();
        });
    }

    bindJoinEvents() {
        const joinCodeInput = document.getElementById('joinRoomCode');
        if (joinCodeInput) {
            joinCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().slice(0, 4);
            });
        }
        document.getElementById('joinRoom')?.addEventListener('click', () => {
            this.playSound('click');
            this.joinRoom();
        });
    }

    bindMobileEvents() {
        this.bindChatDrawer();
        document.getElementById('mobileScoreBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.toggleMobileDrawer('mobileScoreDrawer');
        });
        document.getElementById('mobileSupportBtn')?.addEventListener('click', () => {
            this.playSound('click');
            window.open('https://buymeacoffee.com/anisarzoo', '_blank');
        });
        document.querySelectorAll('.drawer-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.playSound('click');
                this.hideAllDrawers();
            });
        });
    }

    initializeManagers() {
        this.networkManager = new NetworkManager(this);
        this.uiManager = new UIManager(this);
        this.chatManager = new ChatManager(this);
    }

    checkUrlHash() {
        const hash = window.location.hash.substring(1);
        if (hash && hash.startsWith('join=') && hash.length === 9) {
            const roomCode = hash.substring(5).toUpperCase();
            const joinCodeInput = document.getElementById('joinRoomCode');
            if (joinCodeInput) {
                joinCodeInput.value = roomCode;
            }
            const playerName = document.getElementById('playerName')?.value?.trim();
            if (playerName) {
                this.showScreen('joinRoomScreen');
            }
        } else if (hash && hash.length === 4) {
            const joinCodeInput = document.getElementById('joinRoomCode');
            if (joinCodeInput) {
                joinCodeInput.value = hash.toUpperCase();
            }
            const playerName = document.getElementById('playerName')?.value?.trim();
            if (playerName) {
                this.showScreen('joinRoomScreen');
            }
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
        this.uiManager?.onScreenChange(screenId);
    }

    goHome() {
        if (this.networkManager) {
            this.networkManager.leaveRoom();
        }
        if (this.gameInstance) {
            this.gameInstance.cleanup();
            this.gameInstance = null;
        }
        if (this.chatManager) {
            this.chatManager.clearMessages();
        }
        window.location.hash = '';
        this.showScreen('homeScreen');
        this.resetForms();
    }

    resetForms() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.classList.add('hidden');
        });
        document.querySelectorAll('.room-info').forEach(el => {
            el.classList.add('hidden');
        });
        const inputs = ['joinRoomCode'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        document.querySelectorAll('.count-btn, .size-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('.count-btn[data-count="2"]')?.classList.add('active');
        document.querySelector('.size-btn[data-size="5"]')?.classList.add('active');
        this.updatePlayerInputs(2);

        // Restore the create room bar (the fixed-action-bar in createRoomScreen)
        const createRoomScreen = document.getElementById('createRoomScreen');
        if (createRoomScreen) {
            const actionBars = createRoomScreen.querySelectorAll('.fixed-action-bar');
            actionBars.forEach(bar => {
                if (bar.querySelector('#createRoom')) {
                    bar.style.display = '';
                    bar.classList.remove('hidden');
                }
            });
        }
    }

    updatePlayerInputs(count) {
        const playerInputs = ['player3Input', 'player4Input'];
        playerInputs.forEach((id, index) => {
            const input = document.getElementById(id);
            if (input) {
                if (index < count - 2) {
                    input.classList.remove('hidden');
                } else {
                    input.classList.add('hidden');
                }
            }
        });
    }

    startLocalGame() {
        const playerCount = parseInt(document.querySelector('.count-btn.active')?.dataset.count) || 2;
        const gridSize = parseInt(document.querySelector('.size-btn.active')?.dataset.size) || 5;
        const players = [];
        for (let i = 1; i <= playerCount; i++) {
            const input = document.getElementById(`localPlayer${i}`);
            const name = input?.value?.trim() || `Player ${i}`;
            players.push({
                id: i,
                name: name,
                color: this.getPlayerColor(i),
                score: 0
            });
        }
        this.gameInstance = new DotsAndBoxesGame({
            players: players,
            gridSize: gridSize,
            isLocal: true,
            soundManager: this
        });
        this.showScreen('gameScreen');
        this.gameInstance.initialize();
    }

    async createRoom() {
        console.log('createRoom method called');
        const playerCount = parseInt(document.querySelector('.count-btn.active')?.dataset.count) || 2;
        const gridSize = parseInt(document.querySelector('.size-btn.active')?.dataset.size) || 5;
        console.log('Creating room with:', { playerCount, gridSize });
        if (!this.networkManager) {
            console.error('NetworkManager not initialized');
            return;
        }
        try {
            const roomData = await this.networkManager.createRoom(playerCount, gridSize);
            console.log('Room creation result:', roomData);
            if (roomData) {
                // After room is created, if host, write initial game state to database
                if (this.gameInstance && this.networkManager.isRoomHost()) {
                    this.gameInstance.sendGameStateUpdate();
                }
                const roomCreated = document.getElementById('roomCreated');
                if (roomCreated) {
                    roomCreated.classList.remove('hidden');
                    document.getElementById('roomCodeDisplay').textContent = roomData.code;
                    document.getElementById('inviteLink').textContent = roomData.inviteLink;
                    this.updateWaitingText();
                    // Hide the "Create Room" bar at the bottom
                    const createRoomScreen = document.getElementById('createRoomScreen');
                    if (createRoomScreen) {
                        const actionBars = createRoomScreen.querySelectorAll('.fixed-action-bar');
                        actionBars.forEach(bar => {
                            if (bar.querySelector('#createRoom')) {
                                bar.style.display = 'none';
                                bar.classList.add('hidden');
                            }
                        });
                    }
                    // Show the "Start Game" button if needed
                    const startRoomGameBtn = document.getElementById('startRoomGame');
                    if (startRoomGameBtn) {
                        startRoomGameBtn.classList.remove('hidden');
                    }
                } else {
                    console.error('roomCreated element not found');
                }
            } else {
                console.error('Room creation failed');
            }
        } catch (error) {
            console.error('Error creating room:', error);
        }
    }

    async joinRoom() {
        const roomCode = document.getElementById('joinRoomCode')?.value?.trim();
        if (!roomCode || roomCode.length !== 4) {
            this.showError('Please enter a valid 4-letter room code.');
            return;
        }
        const success = await this.networkManager.joinRoom(roomCode);
        if (success) {
            const joinedRoom = document.getElementById('joinedRoom');
            if (joinedRoom) {
                joinedRoom.classList.remove('hidden');
            }
        }
    }

    async startQuickMatch() {
        this.updateMatchingText();
        const result = await this.networkManager.startQuickMatch();
        if (result) {
            if (result.matched) {
                this.showScreen('gameScreen');
                this.startNetworkGame();
            } else if (result.queued) {
                document.getElementById('cancelMatch')?.addEventListener('click', () => {
                    this.playSound('click');
                    this.networkManager.cancelQuickMatch();
                    this.goHome();
                });
            }
        }
    }

    startRoomGame() {
        if (this.networkManager && this.networkManager.isRoomHost()) {
            this.networkManager.startGame();
        }
    }

    updateMatchingText() {
        const messages = [
            '🔍 Looking for an opponent...',
            '📚 Checking classrooms...',
            '✏️ Sharpening pencils...',
            '🎒 Preparing game materials...',
            '📐 Setting up the board...'
        ];
        let index = 0;
        const textElement = document.getElementById('matchingText');
        const interval = setInterval(() => {
            if (textElement && this.currentScreen === 'quickMatchScreen') {
                textElement.textContent = messages[index % messages.length];
                index++;
            } else {
                clearInterval(interval);
            }
        }, 2000);
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getPlayerColor(playerIndex) {
        const colors = ['#e74c3c', '#3498db', '#27ae60', '#2c3e50'];
        return colors[playerIndex - 1] || '#333333';
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    showConfirmModal(message, confirmAction) {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');
        if (modal && messageEl) {
            messageEl.textContent = message;
            this.pendingConfirmAction = confirmAction;
            this.showModal('confirmModal');
        }
    }

    toggleMobileDrawer(drawerId) {
        const drawer = document.getElementById(drawerId);
        if (!drawer) return;
        document.querySelectorAll('.mobile-drawer').forEach(d => {
            if (d.id !== drawerId) {
                d.classList.remove('show');
                d.classList.add('hidden');
            }
        });
        if (drawer.classList.contains('show')) {
            drawer.classList.remove('show');
            setTimeout(() => drawer.classList.add('hidden'), 300);
        } else {
            drawer.classList.remove('hidden');
            setTimeout(() => drawer.classList.add('show'), 10);
        }
    }

    hideAllDrawers() {
        document.querySelectorAll('.mobile-drawer').forEach(drawer => {
            drawer.classList.remove('show');
            setTimeout(() => drawer.classList.add('hidden'), 300);
        });
    }

    showError(message) {
        const errorEl = document.getElementById('joinError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            setTimeout(() => {
                errorEl.classList.add('hidden');
            }, 5000);
        }
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.playSound('click');
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.playSound('click');
        }
    }

    onGameStart(gameData) {
        this.showScreen('gameScreen');
        if (!this.gameInstance) {
            this.gameInstance = new DotsAndBoxesGame({
                ...gameData,
                soundManager: this
            });
            this.gameInstance.initialize();
        }
    }

    onGameEnd(result) {
        this.showEndGameModal(result);
    }

    showEndGameModal(result) {
        const modal = document.getElementById('endGameModal');
        const title = document.getElementById('endGameTitle');
        const message = document.getElementById('endGameMessage');
        const finalScores = document.getElementById('finalScores');
        if (!modal || !title || !message || !finalScores) return;
        if (result.isDraw) {
            title.textContent = '🤝 It\'s a Draw!';
            message.textContent = 'Great game everyone!';
            this.playSound('draw');
        } else if (result.winner) {
            if (result.isLocalPlayer) {
                title.textContent = '🎉 Congratulations!';
                message.textContent = `🎉 Congrats ${result.winner.name}!`;
            } else {
                title.textContent = '😔 Better luck next time!';
                message.textContent = `Better luck next time, ${result.winner.name} won!`;
            }
            this.playSound('win');
            this.createConfetti();
        }
        finalScores.innerHTML = '';
        if (result.finalScores) {
            result.finalScores.forEach(player => {
                const scoreItem = document.createElement('div');
                scoreItem.className = 'final-score-item';
                scoreItem.innerHTML = `
                    <div class="final-score-player">
                        <div class="score-color player-${player.id}" style="background-color: ${player.color}"></div>
                        <span>${player.name}</span>
                    </div>
                    <div class="final-score-points">${player.score}</div>
                `;
                finalScores.appendChild(scoreItem);
            });
        }
        document.getElementById('rematchBtn').onclick = () => {
            this.playSound('click');
            this.hideAllModals();
            this.requestRematch();
        };
        document.getElementById('quitBtn').onclick = () => {
            this.playSound('click');
            this.hideAllModals();
            this.showConfirmModal(
                'Are you sure you want to quit to home?',
                () => this.goHome()
            );
        };
        this.showModal('endGameModal');
    }

    createConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 3 + 's';
                document.body.appendChild(confetti);
                setTimeout(() => {
                    confetti.remove();
                }, 3000);
            }, i * 100);
        }
    }

    requestRematch() {
        if (this.gameInstance) {
            this.gameInstance.requestRematch();
        }
    }

    onNetworkError(error) {
        this.showError(error.message || 'Network error occurred');
    }

    // Network integration methods
    getPlayerName() {
        return document.getElementById('playerName')?.value?.trim() || 'Player';
    }

    updateLobbyPlayers(players) {
        // Update both lobby lists
        this.updatePlayerList(players, 'lobbyPlayersList');
        this.updatePlayerList(players, 'joinedPlayersList');
        // Update waiting text and start button
        this.updateWaitingText(players);
        this.updateStartButton(players);
    }

    updatePlayerList(players, listId) {
        const list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = '';
        players.forEach((player, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="player-color-indicator" style="background-color: ${this.getPlayerColor(index + 1)}"></div>
                <span>${player.name}</span>
                ${player.isHost ? ' (Host)' : ''}
                ${player.connected ? '' : ' (Disconnected)'}
            `;
            list.appendChild(li);
        });
    }

    updateWaitingText(players = null) {
        const waitingText = document.getElementById('waitingText');
        if (!waitingText) return;
        if (!players) {
            waitingText.textContent = '🚌 Waiting for classmates...';
            return;
        }
        const roomData = this.networkManager.getCurrentRoom();
        if (roomData) {
            const remaining = roomData.maxPlayers - players.length;
            if (remaining > 0) {
                waitingText.textContent = `🚌 Waiting for ${remaining} more classmate${remaining !== 1 ? 's' : ''}...`;
            } else {
                waitingText.textContent = '✅ Room is full! Ready to start.';
            }
        }
    }

    updateStartButton(players) {
        const startBtn = document.getElementById('startRoomGame');
        if (startBtn && this.networkManager.isRoomHost() && players.length >= 2) {
            startBtn.classList.remove('hidden');
        }
    }

    startNetworkGame() {
        // Debug log to check if this is called and what roomStatus is
        console.log('[main.js] startNetworkGame called');
        const roomStatus = this.networkManager.getRoomStatus();
        console.log('[main.js] roomStatus:', roomStatus);
        this.showScreen('gameScreen');
        let gridSize = 5; // default
        if (roomStatus && roomStatus.room) {
            if (this.networkManager.db) {
                const roomRef = this.networkManager.db.ref('rooms/' + roomStatus.room);
                if (!this._gameStateListenerAdded) {
                    this._gameStateListenerAdded = true;
                    roomRef.child('gameState').on('value', snapshot => {
                        const updatedGameState = snapshot.val();
                        console.log('[main.js] Updated gameState:', updatedGameState);
                        // Only create game instance if it does not exist and state is valid
                        if (!this.gameInstance && updatedGameState && updatedGameState.players && updatedGameState.lines) {
                            // Use players, gridSize, and state from host
                            const playersArr = updatedGameState.players.map((p, idx) => ({
                                id: idx + 1,
                                name: p.name,
                                isHost: p.isHost,
                                score: p.score || 0,
                                color: this.getPlayerColor(idx + 1)
                            }));
                            const gs = updatedGameState.gridSize || gridSize;
                            this.initializeGameInstance(roomStatus, updatedGameState, playersArr, gs);
                        } else if (this.gameInstance) {
                            this.gameInstance.handleNetworkUpdate(updatedGameState);
                        }
                    });
                }

                if (!this._playersListenerAdded) {
                    this._playersListenerAdded = true;
                    roomRef.child('players').on('value', snapshot => {
                        const updatedPlayers = snapshot.val() || {};
                        const updatedPlayersArr = Object.values(updatedPlayers).map((p, idx) => ({
                            id: idx + 1,
                            name: p.name,
                            isHost: p.isHost,
                            score: p.score || 0,
                            color: this.getPlayerColor(idx + 1)
                        }));
                        console.log('[main.js] Updated players:', updatedPlayersArr);
                        if (this.gameInstance) {
                            this.gameInstance.updatePlayers(updatedPlayersArr);
                        } else {
                            // Initialize game instance if not already initialized
                            this.initializeGameInstance(roomStatus, null, updatedPlayersArr, gridSize);
                        }
                    });
                }

                Promise.all([
                    roomRef.child('gridSize').once('value'),
                    roomRef.child('players').once('value'),
                    roomRef.child('gameState').once('value')
                ]).then(([gridSizeSnap, playersSnap, gameStateSnap]) => {
                    const dbGridSize = gridSizeSnap.val();
                    if (dbGridSize) gridSize = dbGridSize;

                    const playersObj = playersSnap.val() || {};
                    const playersArr = Object.values(playersObj).map((p, idx) => ({
                        id: idx + 1,
                        name: p.name,
                        isHost: p.isHost,
                        score: p.score || 0,
                        color: this.getPlayerColor(idx + 1)
                    }));

                    console.log('[main.js] playersArr:', playersArr);

                    const gameState = gameStateSnap.val() || {};
                    console.log('[main.js] Initial gameState:', gameState);

                    this.initializeGameInstance(roomStatus, gameState, playersArr, gridSize);
                }).catch(error => {
                    console.error('[main.js] Error fetching room data:', error);
                });
            } else {
                console.error('[main.js] Firebase database not initialized');
            }
        } else {
            console.error('[main.js] Invalid room status');
        }
    }

    initializeGameInstance(roomStatus, gameState = null, playersArr = [], gridSize = 5) {
        // Only initialize if not already initialized
        if (this.gameInstance) return;
        this.gameInstance = new DotsAndBoxesGame({
            isLocal: false,
            networkManager: this.networkManager,
            soundManager: this,
            roomCode: roomStatus.room,
            gridSize: gridSize,
            players: playersArr,
            initialState: gameState
        });

        this.gameInstance.initialize();

        if (this.chatManager) {
            this.chatManager.gameStarted();
        }
    }

    handleQuickMatchFound() {
        // Debug log to check if this is called
        console.log('[main.js] handleQuickMatchFound called');
        // Called when quick match opponent is found
        this.startNetworkGame();
    }

    // Chat integration methods
    updateChatDrawer() {
        if (this.chatManager) {
            this.chatManager.clearChatNotification();
        }
    }

    bindChatDrawer() {
        document.getElementById('mobileChatBtn')?.addEventListener('click', () => {
            this.playSound('click');
            this.toggleMobileDrawer('mobileChatDrawer');
            this.updateChatDrawer();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dotsAndBoxesApp = new DotsAndBoxesApp();
});