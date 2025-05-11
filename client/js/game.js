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
            boardLayout = JSON.parse(localStorage.getItem('boardLayout'));
            playerPositions = JSON.parse(localStorage.getItem('initialPositions')) || {};
            playerOrder = JSON.parse(localStorage.getItem('playerOrder')) || [];
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
            showTriviaPopup(data.questionText); // You'll need to fetch image and choices
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
    for (let i = 0; i < board.length; i++) {
        const square = document.createElement('div');
        square.classList.add('square');
        square.textContent = board[i].index + 1;
        if (board[i].isTrivia) {
            square.classList.add('trivia-square');
        }
        if (i === 0) {
            square.classList.add('start-square');
            square.textContent = 'Start';
        }
        if (i === board.length - 1) {
            square.classList.add('finish-square');
            square.textContent = 'Finish';
        }
        boardContainer.appendChild(square);
    }
}

function updatePlayerPositions(positions) {
    playerPositions = positions;
    const squares = document.querySelectorAll('#board-container .square');
    squares.forEach(square => {
        // Remove previous player pieces
        const pieces = square.querySelectorAll('.player-piece');
        pieces.forEach(piece => piece.remove());

        // Add current player pieces
        for (const pId in positions) {
            const position = positions[pId];
            if (boardLayout && position >= 0 && position < boardLayout.length && squares[position]) {
                const player = playerOrder.find(id => id.toString() === pId);
                const playerIndex = playerOrder.indexOf(parseInt(pId));
                const piece = document.createElement('div');
                piece.classList.add('player-piece');
                piece.style.backgroundColor = pieceColor; // Use the stored color
                piece.textContent = playerIndex + 1; // Show player number
                squares[position].appendChild(piece);

                // Basic stacking logic (adjust as needed for more than a few players)
                const existingPieces = squares[position].querySelectorAll('.player-piece');
                if (existingPieces.length > 1) {
                    const offset = (existingPieces.length - 1) * 5;
                    piece.style.left = `${10 + offset}px`;
                    piece.style.top = `${10 + offset}px`;
                }
            }
        }
    });
}

rollDiceButton.addEventListener('click', () => {
    if (canRollDice) {
        rollDiceButton.style.display = 'none';
        showDicePopup();
        canRollDice = false;
    }
});

function showDicePopup() {
    dicePopup.style.display = 'block';
    diceRoller.textContent = '';
    let counter = 0;
    diceInterval = setInterval(() => {
        diceRoller.textContent = Math.floor(Math.random() * 10) + 1;
        counter++;
        if (counter >= 10) { // Approximately 1 second
            clearInterval(diceInterval);
        }
    }, 100);
}

stopDiceButton.addEventListener('click', () => {
    if (diceInterval) {
        clearInterval(diceInterval);
        currentDiceRoll = parseInt(diceRoller.textContent);
        setTimeout(() => {
            dicePopup.style.display = 'none';
            sendDiceRoll(currentDiceRoll);
        }, 1000);
    }
});

function sendDiceRoll(roll) {
    const payload = {
        type: 'rollDice',
        playerId: playerId,
        roll: roll
    };
    ws.send(JSON.stringify(payload));
}

function showTriviaPopup(questionText) {
    triviaPopup.style.display = 'block';
    triviaQuestion.textContent = questionText;
    // In a real game, you'd fetch image and choices from the server
    const choices = ["Choice A", "Correct Choice", "Choice C", "Choice D"]; // Placeholder
    shuffleArray(choices);
    document.querySelectorAll('#trivia-choices button').forEach((button, index) => {
        button.textContent = choices[index];
        button.onclick = () => handleTriviaAnswer(choices[index]);
    });
}

function handleTriviaAnswer(answer) {
    triviaPopup.style.display = 'none';
    const payload = {
        type: 'answerTrivia',
        playerId: playerId,
        answer: answer
    };
    ws.send(JSON.stringify(payload));
}

function showResultPopup(isCorrect, correctAnswer) {
    resultMessage.textContent = isCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${correctAnswer}`;
    resultPopup.style.display = 'block';
    setTimeout(() => {
        resultPopup.style.display = 'none';
    }, 2000); // Show result for 2 seconds
}

function showFinishPopup(message) {
    finishText.textContent = message;
    finishPopup.style.display = 'block';
}

newGameButton.addEventListener('click', () => {
    window.location.href = 'index.html';
});

function updateCurrentPlayerDisplay() {
    const currentPlayer = playerOrder.find(id => id === currentPlayerId);
    const playerIndex = playerOrder.indexOf(currentPlayer) + 1;
    currentPlayerDisplay.textContent = `Current Player: Player ${playerIndex}`;
}

// Utility function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

connectWebSocket();

// Ensure the game screen is shown
gameScreen.style.display = 'block';
