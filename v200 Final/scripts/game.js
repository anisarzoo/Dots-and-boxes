// Game Logic - Dots and Boxes core gameplay
class DotsAndBoxesGame {
    constructor(config) {
        this.players = config.players || [];
        this.gridSize = config.gridSize;
        this.isLocal = config.isLocal || false;
        this.soundManager = config.soundManager;
        this.networkManager = config.networkManager;
        if (!this.networkManager) {
            console.error('NetworkManager is not initialized!');
        }
        // Debug log for gridSize and config
        console.log('[DotsAndBoxesGame] Constructor config:', config);
        console.log('[DotsAndBoxesGame] gridSize:', this.gridSize);
        // Debug log for players array
        console.log('[DotsAndBoxesGame] players:', this.players);

        // Game state
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting';
        this.grid = this.initializeGrid();
        this.lines = new Set();
        this.lineOwners = new Map();
        this.boxes = [];
        this.canvas = null;
        this.ctx = null;

        // Visual settings
        this.dotSize = 6;
        this.lineWidth = 4;
        this.gridSpacing = 40;
        this.canvasSize = this.calculateCanvasSize();

        // Hand-drawn effect storage
        this.dotOffsets = new Map();
        this.lineSegments = new Map();

        // Animation settings
        this.animationQueue = [];
        this.isAnimating = false;
    }

    initialize() {
        this.setupCanvas();
        this.bindCanvasEvents();
        this.updateUI();
        this.gameState = 'playing';
        this.draw();
    }

    calculateCanvasSize() {
        const baseSize = this.gridSpacing * (this.gridSize - 1) + 100;
        const maxSize = Math.min(window.innerWidth - 40, window.innerHeight - 200);
        return Math.min(baseSize, maxSize);
    }

    setupCanvas() {
        this.canvas = window.innerWidth >= 768 ?
            document.getElementById('gameBoard') :
            document.getElementById('mobileGameBoard');

        // Debug log to check if canvas is found and its ID
        if (!this.canvas) {
            console.error('[DotsAndBoxesGame] Canvas not found! Expected ID:', window.innerWidth >= 768 ? 'gameBoard' : 'mobileGameBoard');
        } else {
            console.log('[DotsAndBoxesGame] Canvas found:', this.canvas.id);
            console.log('[DotsAndBoxesGame] Canvas style size:', this.canvas.style.width, this.canvas.style.height);
        }

        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        const containerSize = this.calculateCanvasSize();

        this.canvas.style.width = containerSize + 'px';
        this.canvas.style.height = containerSize + 'px';

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = containerSize * dpr;
        this.canvas.height = containerSize * dpr;

        this.ctx.scale(dpr, dpr);

        this.gridSpacing = (containerSize - 100) / (this.gridSize - 1);
        this.grid = this.initializeGrid();

        this.dotOffsets.clear();
        this.lineSegments.clear();

        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    initializeGrid() {
        const grid = [];
        for (let row = 0; row < this.gridSize; row++) {
            grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                grid[row][col] = {
                    x: 50 + col * this.gridSpacing,
                    y: 50 + row * this.gridSpacing,
                    row: row,
                    col: col
                };
            }
        }
        return grid;
    }

    bindCanvasEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    }

    handleCanvasClick(e) {
        if (!this.canMakeMove()) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * (scaleX / dpr);
        const y = (e.clientY - rect.top) * (scaleY / dpr);

        this.handleInput(x, y);
    }

    handleTouchStart(e) {
        if (!this.canMakeMove()) return;

        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const dpr = window.devicePixelRatio || 1;
        const x = (touch.clientX - rect.left) * (scaleX / dpr);
        const y = (touch.clientY - rect.top) * (scaleY / dpr);

        this.handleInput(x, y);
    }

    handleTouchMove(e) {
        e.preventDefault();
    }

    handleTouchEnd(e) {
        e.preventDefault();
    }

    handleCanvasHover(e) {
        if (this.gameState !== 'playing') return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left) * (scaleX / dpr);
        const y = (e.clientY - rect.top) * (scaleY / dpr);

        const line = this.findNearestLine(x, y);
        if (line && !this.isLineDrawn(line)) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleInput(x, y) {
        console.log('[DotsAndBoxesGame] handleInput called:', x, y);
        const line = this.findNearestLine(x, y);
        if (line && !this.isLineDrawn(line)) {
            console.log('[DotsAndBoxesGame] Valid line found:', line);
            this.drawLine(line);
        } else {
            console.log('[DotsAndBoxesGame] No valid line found or already drawn.');
        }
    }

    findNearestLine(x, y) {
        const threshold = Math.max(30, this.gridSpacing * 0.6);
        let nearestLine = null;
        let minDistance = threshold;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize - 1; col++) {
                const start = this.grid[row][col];
                const end = this.grid[row][col + 1];
                const distance = this.pointToLineDistance(x, y, start.x, start.y, end.x, end.y);
                if (this.isPointInLineSegment(x, y, start.x, start.y, end.x, end.y) && distance < minDistance) {
                    minDistance = distance;
                    nearestLine = {
                        type: 'horizontal',
                        row: row,
                        col: col,
                        start: start,
                        end: end
                    };
                }
            }
        }

        for (let row = 0; row < this.gridSize - 1; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const start = this.grid[row][col];
                const end = this.grid[row + 1][col];
                const distance = this.pointToLineDistance(x, y, start.x, start.y, end.x, end.y);
                if (this.isPointInLineSegment(x, y, start.x, start.y, end.x, end.y) && distance < minDistance) {
                    minDistance = distance;
                    nearestLine = {
                        type: 'vertical',
                        row: row,
                        col: col,
                        start: start,
                        end: end
                    };
                }
            }
        }

        return nearestLine;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) return Math.sqrt(A * A + B * B);

        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));

        const xx = x1 + param * C;
        const yy = y1 + param * D;

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    isPointInLineSegment(px, py, x1, y1, x2, y2) {
        const buffer = Math.max(25, this.gridSpacing * 0.4);
        const minX = Math.min(x1, x2) - buffer;
        const maxX = Math.max(x1, x2) + buffer;
        const minY = Math.min(y1, y2) - buffer;
        const maxY = Math.max(y1, y2) + buffer;

        return px >= minX && px <= maxX && py >= minY && py <= maxY;
    }

    drawLine(line) {
        const lineKey = this.getLineKey(line);
        if (this.lines.has(lineKey)) return;
        // Debug log to confirm drawLine is called
        console.log('[DotsAndBoxesGame] drawLine called:', line);

        this.lines.add(lineKey);
        this.lineOwners.set(lineKey, this.currentPlayerIndex);

        const currentPlayer = this.players[this.currentPlayerIndex];
        const theme = document.body.classList.contains('theme-whiteboard') ? 'whiteboard' : 'greenboard';
        const soundName = theme === 'greenboard' ? 'chalk' : 'marker';
        this.soundManager?.playSound(soundName);

        this.createDrawEffect(line);

        const completedBoxes = this.checkCompletedBoxes(line);
        let boxesCompleted = 0;

        completedBoxes.forEach(box => {
            const existingBox = this.boxes.find(b => b.row === box.row && b.col === box.col);
            if (!existingBox) {
                this.boxes.push({
                    row: box.row,
                    col: box.col,
                    owner: this.currentPlayerIndex // Use index for consistency
                });
                console.log('[move] Added new box:', {
                    row: box.row,
                    col: box.col,
                    owner: this.currentPlayerIndex,
                    playerName: this.players[this.currentPlayerIndex]?.name
                });
                currentPlayer.score++;
                boxesCompleted++;
            }
        });

        if (boxesCompleted > 0) {
            this.animateBoxCompletion(completedBoxes);
        } else {
            this.nextTurn();
        }

        this.updateUI();

        if (this.isGameFinished()) {
            this.endGame();
        }

        this.draw();

        if (!this.isLocal && this.networkManager) {
            console.log('[DotsAndBoxesGame] Sending move to network...');
            // Debug: log boxes before sending
            console.log('[DotsAndBoxesGame] Boxes before network send:', this.boxes);
            this.networkManager.makeMove({
                line: line,
                lineKey: lineKey,
                currentPlayer: this.currentPlayerIndex,
                completedBoxes: completedBoxes.map(box => ({
                    row: box.row,
                    col: box.col,
                    owner: this.players[this.currentPlayerIndex]?.name // Store owner as player name
                }))
            });

            this.sendGameStateUpdate();
        }
    }

    createDrawEffect(line) {
        const theme = document.body.classList.contains('theme-whiteboard') ? 'whiteboard' : 'greenboard';

        if (theme === 'greenboard') {
            this.createChalkDust(line.start.x + (line.end.x - line.start.x) / 2,
                line.start.y + (line.end.y - line.start.y) / 2);
        } else {
            this.createMarkerEffect(line);
        }
    }

    createChalkDust(x, y) {
        const dust = document.createElement('div');
        dust.className = 'chalk-dust';
        dust.style.position = 'absolute';
        dust.style.left = x + 'px';
        dust.style.top = y + 'px';
        dust.style.pointerEvents = 'none';

        this.canvas.parentElement.appendChild(dust);

        setTimeout(() => {
            dust.remove();
        }, 500);
    }

    createMarkerEffect(line) {
        const effect = document.createElement('div');
        effect.className = 'marker-effect';
        effect.style.position = 'absolute';
        effect.style.left = (line.start.x + (line.end.x - line.start.x) / 2) + 'px';
        effect.style.top = (line.start.y + (line.end.y - line.start.y) / 2) + 'px';
        effect.style.pointerEvents = 'none';

        const currentPlayer = this.players[this.currentPlayerIndex];
        effect.style.setProperty('--player-color', currentPlayer.color);

        this.canvas.parentElement.appendChild(effect);

        setTimeout(() => {
            effect.remove();
        }, 300);
    }

    getLineKey(line) {
        return `${line.type}-${line.row}-${line.col}`;
    }

    isLineDrawn(line) {
        return this.lines.has(this.getLineKey(line));
    }

    checkCompletedBoxes(line) {
        const completedBoxes = [];

        if (line.type === 'horizontal') {
            if (line.row > 0) {
                const box = this.getBox(line.row - 1, line.col);
                if (this.isBoxComplete(box)) {
                    completedBoxes.push(box);
                }
            }
            if (line.row < this.gridSize - 1) {
                const box = this.getBox(line.row, line.col);
                if (this.isBoxComplete(box)) {
                    completedBoxes.push(box);
                }
            }
        } else {
            if (line.col > 0) {
                const box = this.getBox(line.row, line.col - 1);
                if (this.isBoxComplete(box)) {
                    completedBoxes.push(box);
                }
            }
            if (line.col < this.gridSize - 1) {
                const box = this.getBox(line.row, line.col);
                if (this.isBoxComplete(box)) {
                    completedBoxes.push(box);
                }
            }
        }

        completedBoxes.forEach(box => {
            // Always set owner as player name for consistency (for network and local)
            box.owner = this.players[this.currentPlayerIndex]?.name;
            console.log('[checkBoxCompletion] Setting box owner:', {
                box: box,
                owner: box.owner,
                currentPlayer: this.players[this.currentPlayerIndex]
            });
        });

        return completedBoxes;
    }

    getBox(row, col) {
        if (row < 0 || row >= this.gridSize - 1 || col < 0 || col >= this.gridSize - 1) {
            return null;
        }

        return {
            row: row,
            col: col,
            top: `horizontal-${row}-${col}`,
            bottom: `horizontal-${row + 1}-${col}`,
            left: `vertical-${row}-${col}`,
            right: `vertical-${row}-${col + 1}`
        };
    }

    isBoxComplete(box) {
        if (!box) return false;

        return this.lines.has(box.top) &&
            this.lines.has(box.bottom) &&
            this.lines.has(box.left) &&
            this.lines.has(box.right);
    }

    animateBoxCompletion(completedBoxes) {
        this.animationQueue.push(...completedBoxes);

        if (!this.isAnimating) {
            this.processAnimationQueue();
        }
    }

    processAnimationQueue() {
        if (this.animationQueue.length === 0) {
            this.isAnimating = false;
            return;
        }

        this.isAnimating = true;
        const box = this.animationQueue.shift();

        this.animateBoxFill(box, () => {
            this.processAnimationQueue();
        });
    }

    animateBoxFill(box, callback) {
        let opacity = 0;
        const animate = () => {
            opacity += 0.1;

            if (opacity >= 1) {
                opacity = 1;
                callback();
                return;
            }

            this.draw();
            requestAnimationFrame(animate);
        };

        animate();
    }

    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    isGameFinished() {
        const totalBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        return this.boxes.length === totalBoxes;
    }

    getAllCompletedBoxes() {
        const completedBoxes = [];

        for (let row = 0; row < this.gridSize - 1; row++) {
            for (let col = 0; col < this.gridSize - 1; col++) {
                const box = this.getBox(row, col);
                if (this.isBoxComplete(box)) {
                    const existingBox = this.boxes.find(b => b.row === row && b.col === col);
                    const owner = existingBox ? existingBox.owner : this.currentPlayerIndex;

                    completedBoxes.push({
                        row: row,
                        col: col,
                        owner: owner
                    });
                }
            }
        }

        return completedBoxes;
    }

    endGame() {
        this.gameState = 'finished';

        this.players.forEach((player, index) => {
            // Handle both string (name) and number (index) owner formats
            player.score = this.boxes.filter(box => 
                box.owner === player.name || box.owner === index
            ).length;
        });

        const maxScore = Math.max(...this.players.map(p => p.score));
        const winners = this.players.filter(player => player.score === maxScore);

        const result = {
            isDraw: winners.length > 1,
            winner: winners.length === 1 ? winners[0] : null,
            finalScores: this.players.sort((a, b) => b.score - a.score),
            isLocalPlayer: this.isLocal || this.isLocalPlayerTurn()
        };

        if (this.soundManager && this.soundManager.onGameEnd) {
            this.soundManager.onGameEnd(result);
        }

        if (!this.isLocal && this.soundManager.chatManager) {
            this.soundManager.chatManager.gameEnded(result.winner?.name);
        }
    }

    updateUI() {
        this.updateScoreboard();
        this.updateCurrentTurn();
        this.updateCursor();
    }

    updateCursor() {
        document.body.classList.remove('player-1-turn', 'player-2-turn', 'player-3-turn', 'player-4-turn');

        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer) {
            document.body.classList.add(`player-${currentPlayer.id}-turn`);
        }
    }

    updateScoreboard() {
        if (!this.players || !Array.isArray(this.players)) {
            console.warn("updateScoreboard: players is not defined or not an array", this.players);
            return;
        }

        const desktopScores = document.getElementById('scoresList');
        const mobileScores = document.getElementById('mobileScoresList');

        [desktopScores, mobileScores].forEach(scoresList => {
            if (scoresList) {
                scoresList.innerHTML = '';

                this.players.forEach((player, index) => {
                    const scoreItem = document.createElement('div');
                    scoreItem.className = `score-item ${index === this.currentPlayerIndex ? 'current-player' : ''}`;

                    scoreItem.innerHTML = `
                        <div class="score-player">
                            <div class="score-color player-${player.id}" style="background-color: ${player.color}"></div>
                            <span class="score-name">${player.name}</span>
                        </div>
                        <div class="score-points">${player.score}</div>
                    `;

                    scoresList.appendChild(scoreItem);
                });
            }
        });
    }

    updateCurrentTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const turnText = currentPlayer ? `${currentPlayer.name}'s turn` : "";

        const desktopTurn = document.getElementById('currentTurnDisplay');
        const mobileTurn = document.getElementById('currentTurnMobile');
        const mobileDrawerTurn = document.getElementById('mobileCurrentTurnDisplay');

        [desktopTurn, mobileTurn, mobileDrawerTurn].forEach(turnEl => {
            if (turnEl) {
                turnEl.textContent = turnText;
                if (currentPlayer) {
                    turnEl.style.color = currentPlayer.color;
                }
            }
        });
    }

    draw() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawHandDrawnDots();
        this.drawHandDrawnLines();
        this.drawCompletedBoxes();
    }

    drawHandDrawnDots() {
        const theme = document.body.classList.contains('theme-whiteboard') ? 'whiteboard' : 'greenboard';

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const dot = this.grid[row][col];
                this.drawImperfectDot(dot.x, dot.y, theme);
            }
        }
    }

    drawImperfectDot(x, y, theme) {
        const dotKey = `${x}-${y}`;

        if (!this.dotOffsets.has(dotKey)) {
            const offsets = [];
            const jitter = 1.5;
            for (let i = 0; i < 3; i++) {
                offsets.push({
                    x: (Math.random() - 0.5) * jitter,
                    y: (Math.random() - 0.5) * jitter,
                    size: this.dotSize + (Math.random() - 0.5) * 1.5
                });
            }

            const specks = [];
            if (theme === 'greenboard') {
                for (let i = 0; i < 4; i++) {
                    specks.push({
                        x: (Math.random() - 0.5) * this.dotSize,
                        y: (Math.random() - 0.5) * this.dotSize
                    });
                }
            }

            this.dotOffsets.set(dotKey, { offsets, specks });
        }

        const { offsets, specks } = this.dotOffsets.get(dotKey);

        if (theme === 'greenboard') {
            this.ctx.fillStyle = '#ffffff';
        } else {
            this.ctx.fillStyle = '#333333';
        }

        offsets.forEach(offset => {
            this.ctx.beginPath();
            this.ctx.arc(x + offset.x, y + offset.y, offset.size / 2, 0, 2 * Math.PI);
            this.ctx.fill();
        });

        if (theme === 'greenboard' && specks.length > 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            specks.forEach(speck => {
                this.ctx.beginPath();
                this.ctx.arc(x + speck.x, y + speck.y, 0.5, 0, 2 * Math.PI);
                this.ctx.fill();
            });
        }
    }

    drawHandDrawnLines() {
        const theme = document.body.classList.contains('theme-whiteboard') ? 'whiteboard' : 'greenboard';

        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.lines.forEach(lineKey => {
            const line = this.parseLineKey(lineKey);
            if (!line) return;

            const playerIndex = this.lineOwners.get(lineKey) || 0;
            this.drawImperfectLine(line, theme, playerIndex);
        });
    }

    drawImperfectLine(line, theme, playerIndex = 0) {
        const lineKey = this.getLineKey(line);

        if (!this.lineSegments.has(lineKey)) {
            const segments = 8;
            const jitter = 2.5;

            const points = [];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const x = line.start.x + (line.end.x - line.start.x) * t;
                const y = line.start.y + (line.end.y - line.start.y) * t;

                let jitterX = 0, jitterY = 0;
                if (i > 0 && i < segments) {
                    jitterX = (Math.random() - 0.5) * jitter;
                    jitterY = (Math.random() - 0.5) * jitter;
                }

                points.push({ x: x + jitterX, y: y + jitterY });
            }

            this.lineSegments.set(lineKey, points);
        }

        const points = this.lineSegments.get(lineKey);

        if (theme === 'greenboard') {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
            this.ctx.shadowBlur = 2;
        } else {
            const player = this.players[playerIndex] || this.players[0];
            this.ctx.strokeStyle = player.color;
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            this.ctx.shadowBlur = 1;
        }

        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }

        this.ctx.stroke();

        if (theme === 'greenboard') {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.lineWidth = this.lineWidth * 0.7;
            this.ctx.setLineDash([2, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(line.start.x, line.start.y);
            this.ctx.lineTo(line.end.x, line.end.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            this.ctx.lineWidth = this.lineWidth;
        }

        this.ctx.shadowBlur = 0;
    }

    drawCompletedBoxes() {
        const theme = document.body.classList.contains('theme-whiteboard') ? 'whiteboard' : 'greenboard';

        this.boxes.forEach(box => {
            this.drawCompletedBox(box.row, box.col, box.owner, theme);
        });
    }

    drawCompletedBox(row, col, owner, theme) {
        const topLeft = this.grid[row][col];
        const bottomRight = this.grid[row + 1][col + 1];

        // Handle both string (name) and number (index) owner formats
        let player;
        if (typeof owner === 'string') {
            player = this.players.find(p => p.name === owner);
        } else if (typeof owner === 'number') {
            player = this.players[owner];
        }
        
        // Debug logging to help diagnose issues
        console.log('[drawCompletedBox] Owner:', owner, 'Type:', typeof owner, 'Player found:', player);
        console.log('[drawCompletedBox] Players array:', this.players);
        
        if (!player) {
            console.warn('[drawCompletedBox] No player found for owner:', owner);
            return;
        }

        let fillColor;
        if (theme === 'greenboard') {
            fillColor = 'rgba(255, 255, 255, 0.08)';
        } else {
            const color = player.color;
            fillColor = this.hexToRgba(color, 0.2);
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(
            topLeft.x + 2, topLeft.y + 2,
            bottomRight.x - topLeft.x - 4,
            bottomRight.y - topLeft.y - 4
        );

        const centerX = (topLeft.x + bottomRight.x) / 2;
        const centerY = (topLeft.y + bottomRight.y) / 2;

        this.ctx.fillStyle = theme === 'greenboard' ? '#ffffff' : player.color;
        this.ctx.font = `bold ${this.gridSpacing * 0.4}px ${theme === 'greenboard' ? 'Schoolbell' : 'Patrick Hand'}, cursive`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const initial = player.name.charAt(0).toUpperCase();
        this.ctx.fillText(initial, centerX, centerY);
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    parseLineKey(lineKey) {
        const [type, row, col] = lineKey.split('-');
        const r = parseInt(row);
        const c = parseInt(col);

        if (type === 'horizontal') {
            return {
                type: 'horizontal',
                row: r,
                col: c,
                start: this.grid[r][c],
                end: this.grid[r][c + 1]
            };
        } else {
            return {
                type: 'vertical',
                row: r,
                col: c,
                start: this.grid[r][c],
                end: this.grid[r + 1][c]
            };
        }
    }

    // Network multiplayer methods
    receiveMove(moveData) {
        console.log('Move received from network:', moveData);
        if (this.isLocal) return;

        this.lines.add(moveData.lineKey);

        if (moveData.completedBoxes && moveData.completedBoxes.length > 0) {
            this.players[moveData.currentPlayer].score += moveData.completedBoxes.length;
        } else {
            this.nextTurn();
        }

        this.updateUI();
        this.draw();

        if (this.isGameFinished()) {
            this.endGame();
        }
    }

    // Network integration methods
    handleNetworkUpdate(gameState) {
        console.log('Network update received:', gameState);
        // Debug: print local state before and after
        console.log('Local state before update:', {
            lines: Array.from(this.lines),
            boxes: this.boxes,
            players: this.players,
            gridSize: this.gridSize
        });
        if (gameState && gameState.boxes) {
            console.log('Network boxes:', gameState.boxes);
        }
        if (gameState && gameState.players) {
            console.log('Network players:', gameState.players);
        }

        if (!gameState || this.isLocal) {
            console.log('Invalid game state or local mode detected');
            return;
        }

        // FULLY RESET all relevant state from network
        this.lines = new Set(gameState.lines || []);
        this.lineOwners = new Map(Object.entries(gameState.lineOwners || {}));
        this.currentPlayerIndex = gameState.currentPlayer !== undefined ? gameState.currentPlayer : 0;
        this.players = (gameState.players || []).map((p, idx) => ({
            id: idx + 1,
            name: p.name,
            isHost: p.isHost,
            score: p.score || 0,
            color: this.soundManager?.getPlayerColor ? this.soundManager.getPlayerColor(idx + 1) : (p.color || '#333333')
        }));
        this.boxes = Array.isArray(gameState.boxes) ? gameState.boxes.map(b => ({ ...b })) : [];

        // Re-initialize grid and visuals if gridSize changed from network
        if (gameState.gridSize && gameState.gridSize !== this.gridSize) {
            this.gridSize = gameState.gridSize;
            this.grid = this.initializeGrid();
            this.dotOffsets.clear();
            this.lineSegments.clear();
            this.canvasSize = this.calculateCanvasSize();
            this.setupCanvas();
        }

        // Clear any local animation or effect state
        this.animationQueue = [];
        this.isAnimating = false;

        console.log('Local state after update:', {
            lines: Array.from(this.lines),
            boxes: this.boxes,
            players: this.players,
            gridSize: this.gridSize
        });

        // Log each box and owner for debugging
        this.boxes.forEach(box => {
            console.log('[handleNetworkUpdate] Box:', box, 'Owner:', box.owner);
        });

        this.updateUI();
        this.draw();
    }

    handleNetworkMove(moveData) {
        if (!moveData || this.isLocal) return;

        const { line, lineKey, currentPlayer, completedBoxes } = moveData;

        if (this.lines.has(lineKey)) {
            console.log('Duplicate move ignored:', lineKey);
            return;
        }

        this.lines.add(lineKey);

        const theme = document.body.classList.contains('theme-whiteboard') ? 'whiteboard' : 'greenboard';
        const soundName = theme === 'greenboard' ? 'chalk' : 'marker';
        this.soundManager?.playSound(soundName);

        if (completedBoxes && completedBoxes.length > 0) {
            this.players[currentPlayer].score += completedBoxes.length;

            completedBoxes.forEach(box => {
                box.owner = currentPlayer;
                // Ensure box is added to the boxes array if not already present
                const existingBox = this.boxes.find(b => b.row === box.row && b.col === box.col);
                if (!existingBox) {
                    this.boxes.push({
                        row: box.row,
                        col: box.col,
                        owner: currentPlayer
                    });
                    console.log('[handleNetworkMove] Added box:', {
                        row: box.row,
                        col: box.col,
                        owner: currentPlayer,
                        playerName: this.players[currentPlayer]?.name
                    });
                }
            });

            this.animateBoxCompletion(completedBoxes);
        }

        this.currentPlayerIndex = currentPlayer;

        if (line) {
            this.createDrawEffect(line);
        }

        this.updateUI();
        this.draw();
    }

    getLocalPlayerIndex() {
        if (this.isLocal) return this.currentPlayerIndex;

        const localPlayerName = this.soundManager?.getPlayerName?.() || 'Player';
        return this.players.findIndex(p => p.name === localPlayerName);
    }

    isLocalPlayerTurn() {
        if (this.isLocal) return true;

        const localIndex = this.getLocalPlayerIndex();
        return localIndex === this.currentPlayerIndex;
    }

    canMakeMove() {
        if (this.gameState !== 'playing' || this.isAnimating) return false;

        if (this.isLocal) return true;

        return this.isLocalPlayerTurn();
    }

    sendGameStateUpdate() {
        if (this.isLocal || !this.networkManager) return;
        // Include lineOwners in the game state
        const lineOwnersObj = {};
        this.lineOwners.forEach((owner, lineKey) => {
            lineOwnersObj[lineKey] = owner;
        });
        const gameState = {
            lines: Array.from(this.lines),
            lineOwners: lineOwnersObj,
            currentPlayer: this.currentPlayerIndex,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                isHost: p.isHost,
                score: p.score,
                color: p.color
            })),
            gameState: this.gameState
        };
        console.log('[DotsAndBoxesGame] sendGameStateUpdate called:', gameState);
        this.networkManager.updateGameState(gameState);
    }

    cleanup() {
        if (this.canvas) {
            this.canvas.removeEventListener('click', this.handleCanvasClick);
            this.canvas.removeEventListener('mousemove', this.handleCanvasHover);
            this.canvas.removeEventListener('touchstart', this.handleTouchStart);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
            this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        }

        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.gameState = 'finished';
    }

    handleResize() {
        this.setupCanvas();
        this.grid = this.initializeGrid();
        this.draw();
    }

    initializeQuickMatch() {
        console.log('Initializing Quick Match...');
        this.networkManager.requestQuickMatch();

        this.networkManager.on('gameStart', (gameState) => {
            console.log('Game started:', gameState);
            this.handleNetworkUpdate(gameState);
        });
    }

    updatePlayers(newPlayers) {
        this.players = newPlayers;
        this.updateUI();
        this.draw();
    }

    getNetworkGameState() {
        return {
            lines: Array.from(this.lines),
            lineOwners: Object.fromEntries(this.lineOwners),
            currentPlayer: this.currentPlayerIndex,
            players: this.players.map(p => ({
                name: p.name,
                isHost: p.isHost,
                score: p.score,
                color: p.color
            })),
            boxes: this.boxes.map(b => ({ ...b }))
        };
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    if (window.dotsAndBoxesApp && window.dotsAndBoxesApp.gameInstance) {
        window.dotsAndBoxesApp.gameInstance.handleResize();
    }
});

// Do NOT declare NetworkManager here again!
// Import or require it from your network.js file if needed

// Example usage (assuming you import NetworkManager from network.js):
// const networkManagerInstance = new NetworkManager();
// const gameInstance = new DotsAndBoxesGame({
//     players: [],
//     gridSize: 5,
//     isLocal: false,
//     soundManager: soundManagerInstance,
//     networkManager: networkManagerInstance
// });