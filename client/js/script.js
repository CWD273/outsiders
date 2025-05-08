const lobbyScreen = document.getElementById('lobby-screen');
const usernameInput = document.getElementById('username');
const iconSelectionDiv = document.getElementById('icon-selection'); // Get the icon selection div
const gameCodeJoinInput = document.getElementById('game-code-join');
const joinButton = document.getElementById('join-button');
const createButton = document.getElementById('create-button');
const joinGameConfirmButton = document.getElementById('join-game-confirm-button');
const initialButtonsDiv = document.getElementById('initial-buttons');
const joinGameSectionDiv = document.getElementById('join-game-section');
const lobbyPlayersDiv = document.getElementById('lobby-players');
const startGameButton = document.getElementById('start-game-button');
const lobbyErrorDiv = document.getElementById('lobby-error');
const joinLoadingIndicator = document.getElementById('join-loading');
const createLoadingIndicator = document.getElementById('create-loading');

let ws;
let gameCode;
let playerId;
let playersInLobby = [];
let selectedIcon = null; // Variable to store the selected icon path

// --- WebSocket Connection ---
function connectWebSocket() {
    const backendUrl = 'https://outsiders-49p8.onrender.com';
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
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// --- UI State Management ---
function showLobby() {
    lobbyScreen.style.display = 'block';
    initialButtonsDiv.style.display = 'none';
    joinGameSectionDiv.style.display = 'none';
    startGameButton.style.display = 'none';
}

function showGame() {
    window.location.href = 'game.html';
}

// --- WebSocket Message Handling ---
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log('Received message in lobby:', data);

    if (createButton) createButton.disabled = false;
    if (createLoadingIndicator) createLoadingIndicator.style.display = 'none';
    if (joinGameConfirmButton) joinGameConfirmButton.disabled = false;
    if (joinLoadingIndicator) joinLoadingIndicator.style.display = 'none';

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
            localStorage.setItem('boardLayout', JSON.stringify(data.board));
            localStorage.setItem('initialPositions', JSON.stringify(data.initialPositions));
            localStorage.setItem('playerOrder', JSON.stringify(data.playerOrder));
            showGame();
            break;
    }
}

function handleGameCreated(newGameCode) {
    gameCode = newGameCode;
    updateLobbyPlayers(playersInLobby);
    lobbyErrorDiv.textContent = `Game created with code: ${gameCode}. Share this code with others.`;
    startGameButton.style.display = 'block';
}

function updateLobby(players) {
    playersInLobby = players;
    updateLobbyPlayers(playersInLobby);
}

function displayLobbyError(message) {
    lobbyErrorDiv.textContent = message;
}

// --- Lobby Functions ---
usernameInput.addEventListener('input', () => {
    if (usernameInput.value.trim() && selectedIcon) { // Only show buttons if username and icon are selected
        initialButtonsDiv.style.display = 'block';
    } else {
        initialButtonsDiv.style.display = 'none';
        joinGameSectionDiv.style.display = 'none';
    }
});

if (iconSelectionDiv) {
    iconSelectionDiv.addEventListener('click', (event) => {
        if (event.target.classList.contains('icon-option')) {
            // Remove selection from any previously selected icon
            const previouslySelected = document.querySelector('.icon-option.selected');
            if (previouslySelected) {
                previouslySelected.classList.remove('selected');
            }

            // Add selection to the clicked icon
            event.target.classList.add('selected');
            selectedIcon = event.target.dataset.icon;

            // Show initial buttons if username is also entered
            if (usernameInput.value.trim()) {
                initialButtonsDiv.style.display = 'block';
            }
        }
    });
}

if (joinButton) {
    joinButton.addEventListener('click', () => {
        joinGameSectionDiv.style.display = 'block';
    });
}

if (createButton) {
    createButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username && selectedIcon) { // Ensure both username and icon are selected
            localStorage.setItem('username', username);
            localStorage.setItem('pieceColor', selectedIcon); // Store the icon path as pieceColor for now
            localStorage.setItem('playerId', Date.now());
            const createPayload = {
                type: 'createGame',
                username: username,
                pieceColor: selectedIcon // Send the icon path
            };
            console.log('Client sending create request:', JSON.stringify(createPayload));
            ws.send(JSON.stringify(createPayload));

            createButton.disabled = true;
            createLoadingIndicator.style.display = 'inline';
        } else {
            displayLobbyError('Please enter a username and select an icon.');
        }
    });
}

if (joinGameConfirmButton) {
    joinGameConfirmButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const gameCodeToJoin = gameCodeJoinInput.value.trim().toUpperCase();
        if (username && selectedIcon) { // Ensure both username and icon are selected
            localStorage.setItem('username', username);
            localStorage.setItem('pieceColor', selectedIcon); // Store the icon path
            localStorage.setItem('playerId', Date.now());
            const joinPayload = {
                type: 'joinGame',
                gameCode: gameCodeToJoin,
                username: username,
                pieceColor: selectedIcon // Send the icon path
            };
            console.log('Client sending join request:', JSON.stringify(joinPayload));
            ws.send(JSON.stringify(joinPayload));

            joinGameConfirmButton.disabled = true;
            joinLoadingIndicator.style.display = 'inline';
        } else {
            displayLobbyError('Please enter a username and select an icon.');
        }
    });
}

function updateLobbyPlayers(players) {
    lobbyPlayersDiv.innerHTML = '<h3>Players in Lobby:</h3>';
    if (players.length > 0) {
        const ul = document.createElement('ul');
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.username} (${player.pieceColor})`; // Display the icon path for now
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
