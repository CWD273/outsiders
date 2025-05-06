// client/js/script.js

const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const podiumScreen = document.getElementById('podium-screen');

const usernameInput = document.getElementById('username');
const pieceColorInput = document.getElementById('piece-color');
const gameCodeJoinInput = document.getElementById('game-code-join');
const joinButton = document.getElementById('join-button');
const createButton = document.getElementById('create-button');
const lobbyPlayersDiv = document.getElementById('lobby-players');
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

// --- WebSocket Connection ---
function connectWebSocket() {
    const backendUrl = 'https://outsiders-49p8.onrender.com'; // Replace with your Render backend URL
    const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');

    ws = new WebSocket(websocketUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established.');
        lobbyScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        podiumScreen.style.display = 'none';
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
                playerId = localStorage.getItem('playerId'); // Retrieve playerId
                if (!playerId) {
                    // Handle case where playerId is not stored (shouldn't happen normally)
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
                finishMessageDiv.textContent = data.winnerId === playerId ? 'You Won!' : `${playersInLobby.find(p => p.playerId === data.winnerId)?.username} won!`;
                finishMessageDiv.style.display = 'block';
                // Implement logic to show podium
                break;
            // ... handle other game events (podium display, etc.)
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
joinButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceColor = pieceColorInput.value;
    const gameCodeToJoin = gameCodeJoinInput.value.trim().toUpperCase();

    if (username) {
        localStorage.setItem('username', username); // Store username
        localStorage.setItem('pieceColor', pieceColor); // Store color
        ws.send(JSON.stringify({
            type: 'joinGame',
            gameCode: gameCodeToJoin,
            username: username,
            pieceColor: pieceColor
        }));
    } else {
        lobbyErrorDiv.textContent = 'Please enter a username.';
    }
});

createButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceColor = pieceColorInput.value;

    if (username) {
        localStorage.setItem('username', username); // Store username
        localStorage.setItem('pieceColor', pieceColor); // Store color
        ws.send(JSON.stringify({
            type: 'createGame',
            username: username,
            pieceColor: pieceColor
        }));
    } else {
        lobbyErrorDiv.textContent = 'Please enter a username.';
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
    // Enable start button only for the creator when there are other players
    const storedUsername = localStorage.getItem('username');
    const isCreator = players.some(p => p.username === storedUsername && playersInLobby.length > 1);
    startGameButton.style.display = isCreator ? 'block' : 'none';
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
    // Clear previous player positions
    boardSquares.forEach(square => {
        const pieces = square.querySelectorAll('.player-piece');
        pieces.forEach(piece => piece.remove());
    });

    playersInLobby.forEach(player => {
        const position = currentPositions[player.playerId];
        if (position >= 0 && position < boardSquares.length) {
            const square = boardSquares[position];
            const piece = document.createElement('div');
            piece.classList.add('player-piece');
            piece.style.backgroundColor = player.pieceColor;
            piece.textContent = player.username.substring(0, 2).toUpperCase(); // Display initials
            square.style.position = 'relative'; // Ensure positioning context
            piece.style.left = `${Math.random() * 60 + 10}%`; // Simple random offset
            piece.style.top = `${Math.random() * 60 + 10}%`;
            square.appendChild(piece);
        } else if (position >= boardSquares.length) {
            // Player finished (visual indication if needed)
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
        const colorSpan = document.createElement('span');
        colorSpan.style.backgroundColor = player.pieceColor;
        colorSpan.style.display = 'inline-block';
        colorSpan.style.width = '10px';
        colorSpan.style.height = '10px';
        colorSpan.style.borderRadius = '50%';
        colorSpan.style.marginRight = '5px';
        li.prepend(colorSpan);
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
// Implement logic to display the podium with top 3 players

newGameButton.addEventListener('click', () => {
    localStorage.removeItem('gameCode'); // Clear any stored game code
    lobbyScreen.style.display = 'block';
    gameScreen.style.display = 'none';
    podiumScreen.style.display = 'none';
    finishMessageDiv.style.display = 'none';
    lobbyErrorDiv.textContent = '';
    playersInLobby = [];
    updateLobbyPlayers(playersInLobby);
    // Optionally, you might want to reconnect the WebSocket if it was closed.
    if (ws.readyState === WebSocket.CLOSED) {
        connectWebSocket();
    }
});

// --- Initialization ---
connectWebSocket();
// client/js/script.js (Continued)

    // ... (previous JavaScript code) ...

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        switch (data.type) {
            // ... (lobby related cases remain the same) ...
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

    // ... (lobby and board functions remain mostly the same) ...

    // --- Podium Display ---
    function displayPodium(podiumPlayers) {
        podiumDiv.innerHTML = '';
        podiumPlayers.forEach((player, index) => {
            if (player) {
                const placeDiv = document.createElement('div');
                placeDiv.classList.add('podium-place');
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('podium-piece');
                pieceDiv.style.backgroundColor = player.pieceColor;
                pieceDiv.textContent = player.username.substring(0, 2).toUpperCase();
                const nameDiv = document.createElement('div');
                nameDiv.textContent = player.username;
                const rankDiv = document.createElement('div');
                rankDiv.textContent = `#${index + 1}`;

                placeDiv.appendChild(pieceDiv);
                placeDiv.appendChild(nameDiv);
                placeDiv.appendChild(rankDiv);
                podiumDiv.appendChild(placeDiv);
            }
        });
    }

    // ... (game play and new game functions remain mostly the same) ...

    // --- Initialization ---
    connectWebSocket();
