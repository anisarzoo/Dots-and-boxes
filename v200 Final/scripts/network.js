// Network Manager - Firebase Realtime Database and multiplayer logic
class NetworkManager {
    constructor(app) {
        this.app = app;
        this.db = null;
        this.currentRoom = null;
        this.playerData = null;
        this.isHost = false;
        this.quickMatchQueue = null;
        this.connectionListeners = new Map();
        this.gameListeners = new Map();
        this.chatListeners = new Map();
        
        this.initFirebase();
    }
    
    initFirebase() {
        // Firebase configuration - Replace with your config
        const firebaseConfig = {
            apiKey: "your-api-key",
            authDomain: "your-project.firebaseapp.com",
            databaseURL: "https://dots-box-default-rtdb.firebaseio.com/",
            projectId: "your-project",
            storageBucket: "your-project.appspot.com",
            messagingSenderId: "123456789",
            appId: "your-app-id"
        };
        
        try {
            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            // Fallback to local mode
            this.showError('Network unavailable. Some features may be limited.');
        }
    }
    
    // Room Management
    async createRoom(maxPlayers = 2, gridSize = 5) {
        if (!this.db) {
            this.showError('Network unavailable');
            return null;
        }
        
        try {
            const roomCode = this.generateRoomCode();
            const playerName = this.app.getPlayerName();
            
            const roomData = {
                code: roomCode,
                host: playerName,
                maxPlayers,
                gridSize,
                players: {
                    [this.sanitizeKey(playerName)]: {
                        name: playerName,
                        isHost: true,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP,
                        connected: true
                    }
                },
                status: 'waiting', // waiting, playing, finished
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                gameState: null,
                chat: {}
            };
            
            const roomRef = this.db.ref(`rooms/${roomCode}`);
            await roomRef.set(roomData);
            
            this.currentRoom = roomCode;
            this.isHost = true;
            this.playerData = roomData.players[this.sanitizeKey(playerName)];
            
            // Set up listeners
            this.setupRoomListeners(roomCode);
            this.setupPresence(roomCode, playerName);
            
            return {
                code: roomCode,
                inviteLink: `${window.location.origin}${window.location.pathname}#join=${roomCode}`
            };
            
        } catch (error) {
            console.error('Error creating room:', error);
            this.showError('Failed to create room. Please try again.');
            return null;
        }
    }
    
    async joinRoom(roomCode) {
        if (!this.db) {
            this.showError('Network unavailable');
            return false;
        }
        
        try {
            const playerName = this.app.getPlayerName();
            const roomRef = this.db.ref(`rooms/${roomCode}`);
            const snapshot = await roomRef.once('value');
            
            if (!snapshot.exists()) {
                this.showError('Room not found. Please check the code.');
                return false;
            }
            
            const roomData = snapshot.val();
            
            if (roomData.status !== 'waiting') {
                this.showError('This room is not accepting new players.');
                return false;
            }
            
            const playerCount = Object.keys(roomData.players || {}).length;
            if (playerCount >= roomData.maxPlayers) {
                this.showError('Room is full.');
                return false;
            }
            
            // Check if player name already exists
            const sanitizedName = this.sanitizeKey(playerName);
            if (roomData.players && roomData.players[sanitizedName]) {
                this.showError('A player with this name is already in the room.');
                return false;
            }
            
            // Add player to room
            const playerRef = roomRef.child(`players/${sanitizedName}`);
            await playerRef.set({
                name: playerName,
                isHost: false,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                connected: true
            });
            
            this.currentRoom = roomCode;
            this.isHost = false;
            this.playerData = {
                name: playerName,
                isHost: false,
                connected: true
            };
            
            // Set up listeners
            this.setupRoomListeners(roomCode);
            this.setupPresence(roomCode, playerName);
            
            return true;
            
        } catch (error) {
            console.error('Error joining room:', error);
            this.showError('Failed to join room. Please try again.');
            return false;
        }
    }
    
    async startQuickMatch() {
        if (!this.db) {
            this.showError('Network unavailable');
            return false;
        }
        
        try {
            const playerName = this.app.getPlayerName();
            const queueRef = this.db.ref('quickMatchQueue');
            
            // Look for existing players in queue
            const snapshot = await queueRef.once('value');
            const queue = snapshot.val() || {};
            
            // Find available opponent
            let opponent = null;
            for (const [key, player] of Object.entries(queue)) {
                if (player.name !== playerName && player.status === 'waiting') {
                    opponent = { key, ...player };
                    break;
                }
            }
            
            if (opponent) {
                // Match found - create room
                const roomCode = this.generateRoomCode();
                await this.createQuickMatchRoom(roomCode, playerName, opponent.name);
                // Notify opponent of the room code (do NOT remove their entry yet)
                await queueRef.child(opponent.key).update({ roomCode });
                // Remove only the host's queue entry
                await queueRef.child(this.sanitizeKey(playerName)).remove();
                // Join the created room
                this.currentRoom = roomCode;
                this.isHost = true;
                this.setupRoomListeners(roomCode);
                // Immediately start game for host
                this.app.handleQuickMatchFound();
                return { matched: true, roomCode };
            } else {
                // No opponent found - join queue
                const queueKey = this.sanitizeKey(playerName);
                await queueRef.child(queueKey).set({
                    name: playerName,
                    status: 'waiting',
                    joinedAt: firebase.database.ServerValue.TIMESTAMP
                });
                
                // Listen for match
                this.quickMatchQueue = queueKey;
                this.setupQuickMatchListeners();
                
                return { matched: false, queued: true };
            }
            
        } catch (error) {
            console.error('Error in quick match:', error);
            this.showError('Quick match failed. Please try again.');
            return false;
        }
    }
    
    async cancelQuickMatch() {
        if (!this.db || !this.quickMatchQueue) return;
        
        try {
            await this.db.ref(`quickMatchQueue/${this.quickMatchQueue}`).remove();
            this.quickMatchQueue = null;
        } catch (error) {
            console.error('Error canceling quick match:', error);
        }
    }
    
    async createQuickMatchRoom(roomCode, player1, player2) {
        // Initialize a fresh, empty game state
        const initialGameState = {
            lines: [],
            lineOwners: {},
            boxes: [],
            players: [
                { name: player1, isHost: true, score: 0 },
                { name: player2, isHost: false, score: 0 }
            ],
            currentPlayer: 0,
            gridSize: 5
        };
        const roomData = {
            code: roomCode,
            host: player1,
            maxPlayers: 2,
            gridSize: 5,
            players: {
                [this.sanitizeKey(player1)]: {
                    name: player1,
                    isHost: true,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP,
                    connected: true
                },
                [this.sanitizeKey(player2)]: {
                    name: player2,
                    isHost: false,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP,
                    connected: true
                }
            },
            status: 'waiting',
            isQuickMatch: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            gameState: initialGameState, // Set to empty state
            chat: {}
        };
        const roomRef = this.db.ref(`rooms/${roomCode}`);
        await roomRef.set(roomData);
    }
    
    // Game State Management
    async updateGameState(gameState) {
        if (!this.db || !this.currentRoom) return;
        
        try {
            const roomRef = this.db.ref(`rooms/${this.currentRoom}/gameState`);
            await roomRef.set(gameState);
        } catch (error) {
            console.error('Error updating game state:', error);
        }
    }
    
    async makeMove(moveData) {
        if (!this.db || !this.currentRoom) return;
        try {
            // Only the host should update the full game state
            if (this.isHost && this.app.gameInstance && typeof this.app.gameInstance.getNetworkGameState === 'function') {
                const fullGameState = this.app.gameInstance.getNetworkGameState();
                await this.updateGameState(fullGameState);
            } else {
                // Non-hosts should NOT update the full game state
                // Optionally, you can send the move to the host via a custom mechanism (not implemented here)
                // Fallback: do nothing or just log
                console.log('Non-host attempted to makeMove; ignoring game state update.');
            }
        } catch (error) {
            console.error('Error making move:', error);
        }
    }
    
    async startGame() {
        if (!this.db || !this.currentRoom || !this.isHost) return;
        
        try {
            const roomRef = this.db.ref(`rooms/${this.currentRoom}`);
            await roomRef.update({
                status: 'playing',
                gameStartedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error starting game:', error);
        }
    }
    
    async endGame(gameResult) {
        if (!this.db || !this.currentRoom) return;
        
        try {
            const roomRef = this.db.ref(`rooms/${this.currentRoom}`);
            await roomRef.update({
                status: 'finished',
                gameResult,
                gameEndedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error ending game:', error);
        }
    }
    
    // Chat Management
    async sendChatMessage(message) {
        if (!this.db || !this.currentRoom) return;
        // Accept both string and object for backward compatibility
        let content = typeof message === 'string' ? message : (message.content || message.message || '');
        if (!content.trim()) return;
        try {
            const chatRef = this.db.ref(`rooms/${this.currentRoom}/chat`);
            const newMessageRef = chatRef.push();
            await newMessageRef.set({
                player: this.app.getPlayerName(),
                message: content.trim(),
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error sending chat message:', error);
        }
    }
    
    // Listeners Setup
    setupRoomListeners(roomCode) {
        if (!this.db) return;
        
        const roomRef = this.db.ref(`rooms/${roomCode}`);
        
        // Players listener
        const playersRef = roomRef.child('players');
        const playersListener = playersRef.on('value', (snapshot) => {
            const players = snapshot.val() || {};
            this.app.updateLobbyPlayers(Object.values(players));
        });
        this.connectionListeners.set('players', { ref: playersRef, listener: playersListener });
        
        // Game state listener
        const gameStateRef = roomRef.child('gameState');
        const gameStateListener = gameStateRef.on('value', (snapshot) => {
            const gameState = snapshot.val();
            if (gameState && this.app.gameInstance) {
                this.app.gameInstance.handleNetworkUpdate(gameState);
            }
        });
        this.gameListeners.set('gameState', { ref: gameStateRef, listener: gameStateListener });
        
        // Room status listener
        const statusRef = roomRef.child('status');
        const statusListener = statusRef.on('value', (snapshot) => {
            const status = snapshot.val();
            if (status === 'playing') {
                this.app.startNetworkGame();
            }
        });
        this.connectionListeners.set('status', { ref: statusRef, listener: statusListener });
        
        // Chat listener
        const chatRef = roomRef.child('chat');
        const chatListener = chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (this.app.chatManager) {
                this.app.chatManager.addMessage(message);
            }
        });
        this.chatListeners.set('chat', { ref: chatRef, listener: chatListener });
    }
    
    setupQuickMatchListeners() {
        if (!this.db || !this.quickMatchQueue) return;
        console.log('[network.js] setupQuickMatchListeners called, quickMatchQueue:', this.quickMatchQueue);
        const queueRef = this.db.ref(`quickMatchQueue/${this.quickMatchQueue}`);
        const findRoomForPlayer = async (retries = 5) => {
            const playerName = this.app.getPlayerName();
            for (let i = 0; i < retries; i++) {
                const roomsSnapshot = await this.db.ref('rooms').once('value');
                const rooms = roomsSnapshot.val() || {};
                let foundRoom = null;
                for (const [roomCode, roomData] of Object.entries(rooms)) {
                    if (roomData && roomData.players && roomData.players[this.sanitizeKey(playerName)]) {
                        foundRoom = roomCode;
                        break;
                    }
                }
                if (foundRoom) {
                    this.currentRoom = foundRoom;
                    console.log('[network.js] Set currentRoom for quick match:', foundRoom);
                    // FIX: Set up listeners for the found room (for non-host)
                    this.setupRoomListeners(foundRoom);
                    return foundRoom;
                }
                // No delay between retries
            }
            console.warn('[network.js] Could not find room for player after retries', playerName);
            return null;
        };
        const listener = queueRef.on('value', async (snapshot) => {
            console.log('[network.js] quickMatchQueue value event:', snapshot.exists());
            if (!snapshot.exists()) {
                // Find the room this player is in and set currentRoom, with retry
                await findRoomForPlayer();
                console.log('[network.js] quickMatchQueue snapshot missing, calling handleQuickMatchFound');
                this.app.handleQuickMatchFound();
            }
        });
        this.connectionListeners.set('quickMatch', { ref: queueRef, listener });
        
        // Listen for roomCode assignment if matched by host
        queueRef.on('value', async (snapshot) => {
            const data = snapshot.val();
            if (data && data.roomCode) {
                // Join the created room as non-host
                this.currentRoom = data.roomCode;
                this.isHost = false;
                this.setupRoomListeners(data.roomCode);
                this.app.handleQuickMatchFound();
                // Remove own queue entry after joining
                await queueRef.remove();
            }
        });
    }
    
    setupPresence(roomCode, playerName) {
        if (!this.db) return;
        
        const playerRef = this.db.ref(`rooms/${roomCode}/players/${this.sanitizeKey(playerName)}/connected`);
        const presenceRef = this.db.ref('.info/connected');
        
        presenceRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                playerRef.set(true);
                playerRef.onDisconnect().set(false);
            }
        });
    }
    
    // Cleanup
    leaveRoom() {
        // Remove all listeners
        this.connectionListeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.gameListeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.chatListeners.forEach(({ ref, listener }) => {
            ref.off('child_added', listener);
        });
        
        this.connectionListeners.clear();
        this.gameListeners.clear();
        this.chatListeners.clear();
        
        // Mark player as disconnected
        if (this.db && this.currentRoom && this.playerData) {
            const playerRef = this.db.ref(`rooms/${this.currentRoom}/players/${this.sanitizeKey(this.playerData.name)}/connected`);
            playerRef.set(false);
        }
        
        this.currentRoom = null;
        this.playerData = null;
        this.isHost = false;
    }
    
    // Utility Functions
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    sanitizeKey(str) {
        return str.replace(/[.#$\/\[\]]/g, '_');
    }
    
    showError(message) {
        if (this.app.uiManager) {
            this.app.uiManager.showNotification(message, 'error');
        } else {
            alert(message);
        }
    }
    
    // Public API for room info
    getCurrentRoom() {
        return this.currentRoom;
    }
    
    isRoomHost() {
        return this.isHost;
    }
    
    getRoomStatus() {
        if (!this.currentRoom) return null;
        return {
            room: this.currentRoom,
            isHost: this.isHost,
            connected: this.db ? true : false
        };
    }
    
    sendGameStateUpdate() {
        if (this.isLocal || !this.networkManager) return;

        const gameState = {
            lines: Array.from(this.lines),
            currentPlayer: this.currentPlayerIndex,
            players: this.players.map(p => ({ score: p.score })),
            gameState: this.gameState
        };

        this.networkManager.updateGameState(gameState);
        console.log('Game state sent:', gameState);
    }

    on(event, callback) {
        if (event === 'gameStart') {
            this.gameStartCallback = callback;
        }
    }

    trigger(event, data) {
        if (event === 'gameStart' && this.gameStartCallback) {
            this.gameStartCallback(data);
        }
    }

    initializeQuickMatch() {
        this.off('gameStart', this.handleNetworkUpdate);
        this.on('gameStart', (gameState) => {
            console.log('Quick Match started:', gameState);
            this.handleNetworkUpdate(gameState);
        });

        this.requestQuickMatch();
        console.log('Quick Match requested');
    }
}