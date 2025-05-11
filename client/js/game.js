const gameScreen = document.getElementById('game-screen');
const boardContainer = document.getElementById('board-container');
const rollDiceButton = document.getElementById('roll-dice-button');
const dicePopup = document.getElementById('dice-popup');
const diceRoller = document.getElementById('dice-roller');
const stopDiceButton = document.getElementById('stop-dice-button');
const triviaPopup = document.getElementById('trivia-popup');
const triviaImage = document.getElementById('trivia-image');
const triviaQuestion = document.getElementById('trivia-question');
const triviaChoices = document.getElementById('trivia-choices');
const resultPopup = document.getElementById('result-popup');
const resultMessage = document.getElementById('result-message');
const finishPopup = document.getElementById('finish-popup');
const finishText = document.getElementById('finish-text');
const newGameButton = document.getElementById('new-game-button');
const currentPlayerDisplay = document.getElementById('current-player');

let ws;
let boardLayout;
let playerPositions = {};
let playerId = localStorage.getItem('playerId');
let username = localStorage.getItem('username');
let pieceColor = localStorage.getItem('pieceColor');
let playerOrder = [];
let currentPlayerId;
let diceInterval;
let currentDiceRoll;
let canRollDice = false;

function connectWebSocket() {
    const backendUrl = 'https://outsiders-49p8.onrender.com';
    const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');
    ws = new WebSocket(websocketUrl);

    ws.onopen = () => {
        console.log('WebSocket connection established on game screen.');
    };

    ws.onmessage = handleWebSocketMessage;

    ws.onclose = () => {
        console.log('WebSocket connection closed on game screen.');
    };

    ws.onerror = (error) => {
        console.error('WebSocket error on game screen:', error);
    };
}

function handleWebSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log('Received message in game:', data);

    switch (data.type) {
        case 'gameStarted':
            boardLayout = data.board; // Get board directly from the server message
            playerPositions = data.initialPositions || {};
            playerOrder = data.playerOrder || [];
            renderBoard(boardLayout);
            updatePlayerPositions(data.initialPositions);
            break;
        case 'diceRolled':
            updatePlayerPositions(data.playerPositions);
            break;
        case 'currentPlayer':
            currentPlayerId = data.playerId;
            updateCurrentPlayerDisplay();
            if (currentPlayerId === playerId) {
                rollDiceButton.style.display = 'block';
                canRollDice = true;
            } else {
                rollDiceButton.style.display = 'none';
                canRollDice = false;
            }
            break;
        case 'triviaQuestion':
            showTriviaPopup(data.questionText, data.choices, data.image);
            break;
        case 'triviaResult':
            showResultPopup(data.correct, data.correctAnswer);
            break;
        case 'playerWon':
            showFinishPopup(data.winnerId === playerId ? 'You Win!' : 'You Lose!');
            break;
        case 'playerPositionsUpdate':
            updatePlayerPositions(data.playerPositions);
            break;
    }
}

function renderBoard(board) {
    boardContainer.innerHTML = '';
