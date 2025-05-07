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
let gameBoardLayout;

// --- WebSocket Connection ---
function connectWebSocket() {
    const backendUrl = 'https://outsiders-49p8.onrender.com'; // Replace with your Render backend URL
    const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');

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
    gameScreen.style.display = 'none';
    podiumScreen.style.display = 'none';
}

function showGame() {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    podiumScreen.style.display = 'none';
}

function showPodium() {
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    podiumScreen.style.display = 'block';
}

// --- WebSocket Message Handling ---
function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log('Received message:', data);

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
            startGame(data.board, data.initialPositions, data.playerOrder);
            break;
        case 'currentPlayer':
            setCurrentPlayer(data.playerId);
            break;
        case 'diceRolled':
            updateGameAfterRoll(data.playerId, data.roll, data.playerPositions);
            break;
        case 'triviaQuestion':
            displayTriviaQuestion(data.questionText);
            break;
        case 'triviaResult':
            displayTriviaResult(data.correct, data.correctAnswer);
            break;
        case 'playerWon':
            handlePlayerWon(data.winnerId);
            break;
        // ... handle other game events (podium display, etc.)
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

function startGame(boardLayout, initialPositions, playerOrder) {
    playerId = localStorage.getItem('playerId');
    if (!playerId) {
        console.error('Player ID not found after game started.');
        return;
    }
    gameBoardLayout = boardLayout;
    playerPositions = initialPositions;
    initializeBoard(gameBoardLayout, playerPositions);
    updateLeaderboard(playerPositions, playersInLobby);
    showGame();
}

function setCurrentPlayer(playerIdTurn) {
    currentPlayerId = playerIdTurn;
    rollDiceButton.disabled = currentPlayerId !== playerId;
}

function updateGameAfterRoll(rolledPlayerId, rollValue, updatedPositions) {
    playerPositions = updatedPositions;
    updateBoard(playerPositions);
    updateLeaderboard(playerPositions, playersInLobby);
    diceResultDiv.textContent = rolledPlayerId === playerId ? `You rolled a ${rollValue}` : `${playersInLobby.find(p => p.playerId === rolledPlayerId)?.username} rolled a ${rollValue}`;
    triviaQuestionDiv.textContent = '';
    triviaAnswerInput.value = '';
    triviaResultDiv.textContent = '';
}

function displayTriviaQuestion(questionText) {
    triviaQuestionDiv.textContent = questionText;
}

function displayTriviaResult(isCorrect, correctAnswer) {
    triviaResultDiv.textContent = isCorrect ? 'Correct!' : `Incorrect. The answer was: ${correctAnswer}`;
}

function handlePlayerWon(winnerId) {
    finishMessageDiv.textContent = winnerId === playerId ? 'You Won!' : `${playersInLobby.find(p => p.playerId === winnerId)?.username} won!`;
    finishMessageDiv.style.display = 'block';
    // Implement logic to show podium
}

// --- Lobby Functions ---
joinButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceColor = pieceColorInput.value;
    const gameCodeToJoin = gameCodeJoinInput.value.trim().toUpperCase();

    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('pieceColor', pieceColor);
        ws.send(JSON.stringify({
            type: 'joinGame',
            gameCode: gameCodeToJoin,
            username: username,
            pieceColor: pieceColor
        }));
    } else {
        displayLobbyError('Please enter a username.');
    }
});

createButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const pieceColor = pieceColorInput.value;

    if (username) {
        localStorage.setItem('username', username);
        localStorage.setItem('pieceColor', pieceColor);
        ws.send(JSON.stringify({
            type: 'createGame',
            username: username,
            pieceColor: pieceColor
        }));
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
    startGameButton.style.display = isCreator ? 'block' : 'none';
}

startGameButton.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'startGame' }));
});

// --- Game Board Functions ---
function initializeBoard(boardLayout, initialPositions) {
    boardContainer.innerHTML = '';
    boardSquares = [];
    boardLayout.forEach(squareData => {
        const square = document.createElement('div');
        square.classList.add('square');
        square.textContent = squareData.index;
        if (squareData.isTrivia) {
            square.classList.add('special-square');
            square.textContent = 'T'; // Indicate trivia square
        } else if (squareData.isStart) {
            square.classList.add('start-square');
            square.textContent = 'S'; // Indicate start square
        } else if (squareData.isFinish) {
            square.classList.add('finish-square');
            square.textContent = 'F'; // Indicate finish square
        }
        boardContainer.appendChild(square);
        boardSquares.push(square);
    });
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
            const piece = document.createElement('div');
            piece.classList.add('player-piece');
            piece.style.backgroundColor = player.pieceColor;
            piece.textContent = player.username.substring(0, 2).toUpperCase();
            square.style.position = 'relative';
            piece.style.left = `${Math.random() * 60 + 10}%`;
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
    localStorage.removeItem('gameCode');
    showLobby();
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
