// client/js/game.js

document.addEventListener('DOMContentLoaded', () => {
    const leaderboardUl = document.getElementById('player-list');
    const boardContainer = document.getElementById('board-container');
    const rollDiceButton = document.getElementById('roll-dice-button');
    const submitAnswerButton = document.getElementById('submit-answer-button');
    const diceResultDiv = document.getElementById('dice-result');
    const triviaQuestionDiv = document.getElementById('trivia-question');
    const triviaAnswerInput = document.getElementById('trivia-answer');
    const triviaResultDiv = document.getElementById('trivia-result-message');
    const finishMessageDiv = document.getElementById('finish-message');
    const podiumDiv = document.getElementById('podium');
    const newGameButton = document.getElementById('new-game-button');

    let ws;
    let gameCode = localStorage.getItem('gameCode');
    let playerId = localStorage.getItem('playerId');
    let playersInLobby = [];
    let boardSquares = [];
    let playerPositions = JSON.parse(localStorage.getItem('initialPositions')) || {};
    let currentPlayerId = localStorage.getItem('currentPlayerId');
    let gameBoardLayout = createGameBoardLayout(); // Call the function to create the layout
    let playerOrder = JSON.parse(localStorage.getItem('playerOrder')) || [];
    const boardSize = 10; // Consistent board size

    // --- Game Board Layout Generation ---
    function createGameBoardLayout() {
        const layout = [];
        let index = 0;

        function addLine(startRow, startCol, directionRow, directionCol, length) {
            let currentRow = startRow;
            let currentCol = startCol;
            for (let i = 0; i < length; i++) {
                layout.push({
                    index: index++,
                    row: currentRow,
                    col: currentCol,
                    isStart: index === 1,
                    isFinish: index === (boardSize * boardSize) - (boardSize - 1),
                    isTrivia: Math.random() < 0.1
                });
                currentRow += directionRow;
                currentCol += directionCol;
            }
        }

        let currentRow = 0;
        let currentCol = boardSize - 1;

        addLine(currentRow, currentCol, 1, 0, boardSize);
        currentCol--;

        for (let i = 0; i < boardSize - 1; i++) {
            addLine(boardSize - 1, currentCol, -1, 0, boardSize);
            currentCol--;
        }

        if (layout.length > 0) {
            layout[layout.length - 1].isFinish = true;
        }

        return layout;
    }

    // --- WebSocket Connection ---
    function connectWebSocket() {
        const backendUrl = 'https://outsiders-49p8.onrender.com';
        const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');
        console.log('Connecting to WebSocket in game:', websocketUrl);

        ws = new WebSocket(websocketUrl);

        ws.onopen = () => {
            console.log('WebSocket connection established in game.');
            // Potentially send a message to the server to indicate you've joined the game view
        };

        ws.onmessage = handleWebSocketMessage;

        ws.onclose = () => {
            console.log('WebSocket connection closed in game.');
            // Handle disconnection
        };

        ws.onerror = (error) => {
            console.error('WebSocket error in game:', error);
        };
    }

    // --- WebSocket Message Handling ---
    function handleWebSocketMessage(event) {
        const data = JSON.parse(event.data);
        console.log('Received message in game:', data);

        switch (data.type) {
            case 'lobbyUpdate':
                playersInLobby = data.players;
                updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
                break;
            case 'currentPlayer':
                currentPlayerId = data.playerId;
                updateRollDiceButtonState();
                break;
            case 'diceRolled':
                playerPositions = data.playerPositions;
                updateBoard(playerPositions, boardContainer);
                updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
                displayDiceRollResult(data.playerId, data.roll);
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
            case 'updatePosition': // Handle position updates from server if needed
                playerPositions = data.playerPositions;
                updateBoard(playerPositions, boardContainer);
                updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
                break;
        }
    }

    // --- Game Board Functions ---
    function initializeBoard(boardLayout, container) {
        if (!container) return;
        container.innerHTML = '';
        boardSquares = [];
        container.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
        container.style.width = `${boardSize * 40}px`; // Adjust width based on square size
        container.style.height = `${boardSize * 40}px`; // Adjust height based on square size

        boardLayout.forEach(squareData => {
            const square = document.createElement('div');
            square.classList.add('square');
            square.dataset.index = squareData.index;

            if (squareData.isTrivia) {
                square.classList.add('special-square');
                square.textContent = 'T';
            } else if (squareData.isStart) {
                square.classList.add('start-square');
                square.textContent = 'S';
            } else if (squareData.isFinish) {
                square.classList.add('finish-square');
                square.textContent = 'F';
            } else {
                square.textContent = '';
            }

            square.style.gridRowStart = squareData.row + 1;
            square.style.gridColumnStart = squareData.col + 1;

            container.appendChild(square);
            boardSquares.push(square);
        });
        updateBoard(playerPositions, container);
    }

    function updateBoard(currentPositions, container) {
        if (!container || !boardSquares) return;
        boardSquares.forEach(square => {
            const pieces = square.querySelectorAll('.player-piece');
            pieces.forEach(piece => piece.remove());
        });

        playersInLobby.forEach(player => {
            const position = currentPositions[player.playerId];
            if (position !== undefined && position >= 0 && position < boardSquares.length) {
                const square = boardSquares[position];
                const piece = document.createElement('div');
                piece.classList.add('player-piece');
                piece.style.backgroundColor = player.pieceColor; // Assuming server sends pieceColor
                piece.textContent = player.username.substring(0, 2).toUpperCase();
                square.style.position = 'relative';
                piece.style.left = `${Math.random() * 60 + 10}%`;
                piece.style.top = `${Math.random() * 60 + 10}%`;
                square.appendChild(piece);
            } else if (position >= boardSquares.length) {
                // Player finished
            }
        });
    }

    // --- Leaderboard Functions ---
    function updateLeaderboard(positions, players, container) {
        if (!container) return;
        container.innerHTML = '';
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
            container.appendChild(li);
        });
    }

    // --- Game Play Functions ---
    function updateRollDiceButtonState() {
        if (rollDiceButton) {
            rollDiceButton.disabled = currentPlayerId !== playerId;
        }
    }

    function displayDiceRollResult(rolledPlayerId, roll) {
        if (diceResultDiv) {
            const playerName = playersInLobby.find(p => p.playerId === rolledPlayerId)?.username || 'Someone';
            diceResultDiv.textContent = rolledPlayerId === playerId ? `You rolled a ${roll}` : `${playerName} rolled a ${roll}`;
        }
    }

    function displayTriviaQuestion(questionText) {
        if (triviaQuestionDiv) {
            triviaQuestionDiv.textContent = questionText;
        }
    }

    function displayTriviaResult(isCorrect, correctAnswer) {
        if (triviaResultDiv) {
            triviaResultDiv.textContent = isCorrect ? 'Correct!' : `Incorrect. The answer was: ${correctAnswer}`;
            // Optionally clear after a short delay
        }
    }

    function handlePlayerWon(winnerId) {
        if (finishMessageDiv) {
            const winnerName = playersInLobby.find(p => p.playerId === winnerId)?.username || 'Someone';
            finishMessageDiv.textContent = winnerId === playerId ? 'You Won!' : `${winnerName} won!`;
            finishMessageDiv.style.display = 'block';
            // Potentially show podium
        }
        if (rollDiceButton) rollDiceButton.disabled = true;
        if (submitAnswerButton) submitAnswerButton.disabled = true;
    }

    function updatePlayerPosition(currentPlayerId, roll) {
        const currentPlayerIndex = playersInLobby.findIndex(p => p.playerId === currentPlayerId);
        if (currentPlayerIndex === -1) return;

        const currentPosition = playerPositions[currentPlayerId] || 0;
        const boardLength = gameBoardLayout.length;
        let newPosition = (currentPosition + roll) % boardLength;
        if (newPosition < 0) {
            newPosition += boardLength;
        }

        playerPositions[currentPlayerId] = newPosition;

        ws.send(JSON.stringify({
            type: 'updatePosition',
            playerId: currentPlayerId,
            newPosition: newPosition,
            playerPositions: playerPositions // Send all positions for simplicity
        }));

        updateBoard(playerPositions, boardContainer);
        updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
    }

    // --- Event Listeners ---
    if (rollDiceButton) {
        rollDiceButton.addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'rollDice', playerId: playerId }));
            rollDiceButton.disabled = true;
        });
    }

    if (submitAnswerButton) {
        submitAnswerButton.addEventListener('click', () => {
            const answer = triviaAnswerInput.value.trim();
            if (answer && triviaQuestionDiv.textContent) {
                ws.send(JSON.stringify({ type: 'answerTrivia', playerId: playerId, answer: answer }));
                triviaAnswerInput.value = '';
                submitAnswerButton.disabled = true;
            }
        });
    }

    if (newGameButton) {
        newGameButton.addEventListener('click', () => {
            localStorage.removeItem('gameCode');
            localStorage.removeItem('boardLayout');
            localStorage.removeItem('initialPositions');
            localStorage.removeItem('playerOrder');
            localStorage.removeItem('currentPlayerId');
            window.location.href = 'index.html';
        });
    }

    // --- Initialization ---
    connectWebSocket();
    initializeBoard(gameBoardLayout, boardContainer);
    updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
    updateRollDiceButtonState();
});
