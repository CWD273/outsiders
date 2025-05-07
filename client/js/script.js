// client/js/script.js

const lobbyScreen = document.getElementById('lobby-screen');
const usernameInput = document.getElementById('username');
const pieceColorInput = document.getElementById('piece-color');
const gameCodeJoinInput = document.getElementById('game-code-join');
const joinButton = document.getElementById('join-button');
const createButton = document.getElementById('create-button');
const lobbyPlayersDiv = document.getElementById('lobby-players');
const startGameButton = document.getElementById('start-game-button');
const lobbyErrorDiv = document.getElementById('lobby-error');

let ws;
let gameCode;
let playerId;
let playersInLobby = [];

// --- WebSocket Connection ---
function connectWebSocket() {
    const backendUrl = 'https://outsiders-49p8.onrender.com'; // Replace with your Render backend URL
    const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');
    console.log('Connecting to WebSocket:', websocketUrl);

    ws = new WebSocket(websocketUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        showLobby();
    };

    ws.onmessage = handleWebSocketMessage;

    ws.onclose = () => {
        console.log('WebSocket connection closed.');
        // Handle disconnection (e.g., show a message to the user)
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// --- UI State Management ---
function showLobby() {
    lobbyScreen.style.display = 'block';
}

function showGame() {
    window.location.href = 'game.html';
}

// --- WebSocket Message Handling ---
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log('Received message in lobby:', data);

    switch (data.type) {
        case 'gameCreated':
            handleGameCreated(data.gameCode);
            break;
        case 'lobbyUpdate':
            updateLobby(data.players);
            break;
        case 'lobbyError':
            displayLobbyError(data.message);
            break;
        case 'gameStarted':
            // Store necessary game info in localStorage for game.html to access
            localStorage.setItem('boardLayout', JSON.stringify(data.board));
            localStorage.setItem('initialPositions', JSON.stringify(data.initialPositions));
            localStorage.setItem('playerOrder', JSON.stringify(data.playerOrder));
            showGame();
            break;
        // We no longer handle game-specific messages here; game.js will do that.
    }
}

function handleGameCreated(newGameCode) {
    gameCode = newGameCode;
    updateLobbyPlayers(playersInLobby);
    lobbyErrorDiv.textContent = `Game created with code: ${gameCode}. Share this code with others.`;
}

function updateLobby(players) {
    playersInLobby = players;
    updateLobbyPlayers(playersInLobby);
}

function displayLobbyError(message) {
    lobbyErrorDiv.textContent = message;
}

// --- Lobby Functions ---
joinButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceColor = pieceColorInput.value;
    const gameCodeToJoin = gameCodeJoinInput.value.trim().toUpperCase();

    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('pieceColor', pieceColor);
        localStorage.setItem('playerId', Date.now()); // Basic player ID for now
        const joinPayload = {
            type: 'joinGame',
            gameCode: gameCodeToJoin,
            username: username,
            pieceColor: pieceColor
        };
        console.log('Client sending join request:', JSON.stringify(joinPayload));
        ws.send(JSON.stringify(joinPayload));
    } else {
        displayLobbyError('Please enter a username.');
    }
});

createButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceColor = pieceColorInput.value;
    localStorage.setItem('username', username);
    localStorage.setItem('pieceColor', pieceColor);
    localStorage.setItem('playerId', Date.now()); // Basic player ID for now
    if (username) {
        const createPayload = {
            type: 'createGame',
            username: username,
            pieceColor: pieceColor
        };
        console.log('Client sending create request:', JSON.stringify(createPayload));
        ws.send(JSON.stringify(createPayload));
    } else {
        displayLobbyError('Please enter a username.');
    }
});

function updateLobbyPlayers(players) {
    lobbyPlayersDiv.innerHTML = '<h3>Players in Lobby:</h3>';
    if (players.length > 0) {
        const ul = document.createElement('ul');
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.username} (${player.pieceColor})`;
            ul.appendChild(li);
        });
        lobbyPlayersDiv.appendChild(ul);
    }
    const storedUsername = localStorage.getItem('username');
    const isCreator = players.some(p => p.username === storedUsername && playersInLobby.length > 1);
    if (startGameButton) startGameButton.style.display = isCreator ? 'block' : 'none';
}

if (startGameButton) {
    startGameButton.addEventListener('click', () => {
        console.log('Client clicked "Start Game" in lobby');
        ws.send(JSON.stringify({ type: 'startGame' }));
    });
}

// --- Initialization ---
connectWebSocket();
