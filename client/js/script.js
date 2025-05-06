const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const podiumScreen = document.getElementById('podium-screen');

const usernameInput = document.getElementById('username');
const pieceIconSelect = document.getElementById('piece-icon');
const gameCodeJoinInput = document.getElementById('game-code-join');
const joinButton = document.getElementById('join-button');
const createButton = document.getElementById('create-button');
const lobbyPlayersGrid = document.getElementById('lobby-players-grid');
const startGameButton = document.getElementById('start-game-button');
const lobbyErrorDiv = document.getElementById('lobby-error');

const leaderboardUl = document.getElementById('player-list');
const boardContainer = document.getElementById('board-container');
const rollDiceButton = document.getElementById('roll-dice-button');
const diceResultDiv = document.getElementById('dice-result');
const triviaQuestionDiv = document.getElementById('trivia-question');
const triviaAnswerInput = document.getElementById('trivia-answer');
const submitAnswerButton = document.getElementById('submit-answer-button');
const triviaResultDiv = document.getElementById('trivia-result-message');
const finishMessageDiv = document.getElementById('finish-message');
const podiumDiv = document.getElementById('podium');
const newGameButton = document.getElementById('new-game-button');

let ws;
let gameCode;
let playerId;
let playersInLobby = [];
let boardSquares = [];
let playerPositions = {};
let currentPlayerId;
const maxPlayers = 16;

// --- WebSocket Connection ---
function connectWebSocket() {
    const backendUrl = 'YOUR_RENDER_BACKEND_URL'; // Replace with your Render backend URL
    const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');

    ws = new WebSocket(websocketUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        lobbyScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        podiumScreen.style.display = 'none';
        populateIconSelector();
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        switch (data.type) {
            case 'gameCreated':
                gameCode = data.gameCode;
                updateLobbyPlayers(playersInLobby);
                lobbyErrorDiv.textContent = `Game created with code: ${gameCode}. Share this code with others.`;
                break;
            case 'lobbyUpdate':
                playersInLobby = data.players;
                updateLobbyPlayers(playersInLobby);
                break;
            case 'lobbyError':
                lobbyErrorDiv.textContent = data.message;
                break;
            case 'gameStarted':
                playerId = localStorage.getItem('playerId');
                if (!playerId) {
                    console.error('Player ID not found after game started.');
                    return;
                }
                playerPositions = data.initialPositions;
                initializeBoard(playerPositions);
                updateLeaderboard(data.initialPositions, playersInLobby);
                lobbyScreen.style.display = 'none';
                gameScreen.style.display = 'block';
                break;
            case 'currentPlayer':
                currentPlayerId = data.playerId;
                if (currentPlayerId === playerId) {
                    rollDiceButton.disabled = false;
                } else {
                    rollDiceButton.disabled = true;
                }
                break;
            case 'diceRolled':
                playerPositions = data.playerPositions;
                updateBoard(playerPositions);
                updateLeaderboard(playerPositions, playersInLobby);
                diceResultDiv.textContent = `You rolled a ${data.roll}`;
                triviaQuestionDiv.textContent = '';
                triviaAnswerInput.value = '';
                triviaResultDiv.textContent = '';
                break;
            case 'triviaQuestion':
                triviaQuestionDiv.textContent = data.questionText;
                break;
            case 'triviaResult':
                triviaResultDiv.textContent = data.correct ? 'Correct!' : `Incorrect. The answer was: ${data.correctAnswer}`;
                break;
            case 'playerWon':
                const finishMessage = data.winnerId === playerId ? `You finished in ${data.finishOrder.indexOf(playerId) + 1} place!` : `${playersInLobby.find(p => p.playerId === data.winnerId)?.username} won! You finished in ${data.finishOrder.indexOf(playerId) + 1} place.`;
                finishMessageDiv.textContent = finishMessage;
                finishMessageDiv.style.display = 'block';
                break;
            case 'showPodium':
                gameScreen.style.display = 'none';
                podiumScreen.style.display = 'block';
                displayPodium(data.podiumPlayers);
                break;
        }
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed.');
        // Handle disconnection (e.g., show a message to the user)
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// --- Lobby Functions ---
function populateIconSelector() {
    pieceIconSelect.innerHTML = '';
    for (let i = 1; i <= 16; i++) {
        const option = document.createElement('option');
        option.value = `icon/${i}.png`;
        option.textContent = `Icon ${i}`;
        pieceIconSelect.appendChild(option);
    }
}

joinButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceIcon = pieceIconSelect.value;
    const gameCodeToJoin = gameCodeJoinInput.value.trim().toUpperCase();

    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('pieceIcon', pieceIcon);
        lobbyErrorDiv.textContent = 'Attempting to join game...';
        ws.send(JSON.stringify({
            type: 'joinGame',
            gameCode: gameCodeToJoin,
            username: username,
            pieceIcon: pieceIcon
        }));
    } else {
        lobbyErrorDiv.textContent = 'Please enter a username.';
    }
});

createButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceIcon = pieceIconSelect.value;

    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('pieceIcon', pieceIcon);
        ws.send(JSON.stringify({
            type: 'createGame',
            username: username,
            pieceIcon: pieceIcon
        }));
    } else {
        lobbyErrorDiv.textContent = 'Please enter a username.';
    }
});

function updateLobbyPlayers(players) {
    lobbyPlayersGrid.innerHTML = '';
    if (players.length > 0) {
        players.forEach(player => {
            const playerContainer = document.createElement('div');
            playerContainer.classList.add('player-icon-container');

            const iconImg = document.createElement('img');
            iconImg.src = player.pieceIcon;
            iconImg.alt = player.username;
            iconImg.classList.add('player-icon');

            const usernameDiv = document.createElement('div');
            usernameDiv.classList.add('player-username-lobby');
            usernameDiv.textContent = player.username;

            playerContainer.appendChild(iconImg);
            playerContainer.appendChild(usernameDiv);
            lobbyPlayersGrid.appendChild(playerContainer);
        });
    }
    const storedUsername = localStorage.getItem('username');
    const isCreator = players.some(p => p.username === storedUsername && players.length > 1);
    startGameButton.style.display = isCreator && players.length <= maxPlayers ? 'block' : 'none';
    if (players.length >= maxPlayers) {
        lobbyErrorDiv.textContent = 'Lobby is full (16 players).';
        joinButton.disabled = true;
        createButton.disabled = true;
    } else {
        lobbyErrorDiv.textContent = '';
        joinButton.disabled = false;
        createButton.disabled = false;
    }
}

startGameButton.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'startGame' }));
});

// --- Game Board Functions ---
function initializeBoard(initialPositions) {
    boardContainer.innerHTML = '';
    boardSquares = [];
    for (let i = 0; i < 205; i++) {
        const square = document.createElement('div');
        square.classList.add('square');
        square.textContent = i;
        if ((i + 1) % 10 === 0 && i !== 0 && i < 200) {
            square.classList.add('special-square');
        }
        boardContainer.appendChild(square);
        boardSquares.push(square);
    }
    updateBoard(initialPositions);
}

function updateBoard(currentPositions) {
    boardSquares.forEach(square => {
        const pieces = square.querySelectorAll('.player-piece');
        pieces.forEach(piece => piece.remove());
    });

    playersInLobby.forEach(player => {
        const position = currentPositions[player.playerId];
        if (position >= 0 && position < boardSquares.length) {
            const square = boardSquares[position];
            const piece = document.createElement('img');
            piece.classList.add('player-piece');
            piece.src = player.pieceIcon;
            piece.alt = player.username;
            square.style.position = 'relative';
            piece.style.width = '30px';
            piece.style.height = '30px';
            piece.style.position = 'absolute';
            piece.style.left = `${Math.random() * 60 + 10}%`;
            piece.style.top = `${Math.random() * 60 + 10}%`;
            square.appendChild(piece);
        } else if (position >= boardSquares.length) {
            // Player finished
        }
    });
}

// --- Leaderboard Functions ---
function updateLeaderboard(positions, players) {
    leaderboardUl.innerHTML = '';
    const sortedPlayers = players.sort((a, b) => (positions[b.playerId] || 0) - (positions[a.playerId] || 0));
    sortedPlayers.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.username}: ${positions[player.playerId] || 0}`;
        const iconImg = document.createElement('img');
        iconImg.src= player.pieceIcon;
        iconImg.style.width = '16px';  // Adjust size as needed
        iconImg.style.height = '16px';
        iconImg.style.marginRight = '5px';
        li.prepend(iconImg);
        leaderboardUl.appendChild(li);
    });
}

// --- Game Play Functions ---
rollDiceButton.addEventListener('click', () => {
    if (currentPlayerId === playerId) {
        ws.send(JSON.stringify({ type: 'rollDice', playerId: playerId }));
        rollDiceButton.disabled = true;
    }
});

submitAnswerButton.addEventListener('click', () => {
    const answer = triviaAnswerInput.value.trim();
    if (answer && triviaQuestionDiv.textContent) {
        ws.send(JSON.stringify({ type: 'answerTrivia', playerId: playerId, answer: answer }));
    }
});

// --- Podium and New Game ---
function displayPodium(podiumPlayers) {
    podiumDiv.innerHTML = '';
    podiumPlayers.forEach((player, index) => {
        if (player) {
            const placeDiv = document.createElement('div');
            placeDiv.classList.add('podium-place');
            const pieceImg = document.createElement('img');
            pieceImg.classList.add('podium-piece');
            pieceImg.src = player.pieceIcon;
            pieceImg.style.width = '40px';
            pieceImg.style.height = '40px';
            pieceImg.alt = player.username;
            const nameDiv = document.createElement('div');
            nameDiv.textContent = player.username;
            const rankDiv = document.createElement('div');
            rankDiv.textContent = `#${index + 1}`;

            placeDiv.appendChild(pieceImg);
            placeDiv.appendChild(nameDiv);
            placeDiv.appendChild(rankDiv);
            podiumDiv.appendChild(placeDiv);
        }
    });
}

newGameButton.addEventListener('click', () => {
    localStorage.removeItem('gameCode');
    lobbyScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    podiumScreen.style.display = 'none';
    finishMessageDiv.style.display = 'none';
    lobbyErrorDiv.textContent = '';
    playersInLobby = [];
    updateLobbyPlayers(playersInLobby);
    if (ws.readyState === WebSocket.CLOSED) {
        connectWebSocket();
    }
});

// --- Initialization ---
connectWebSocket();
