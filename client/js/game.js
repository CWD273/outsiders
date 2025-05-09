// js/game.js

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
    let gameBoardLayout = createGameBoardLayout();
    let playerOrder = JSON.parse(localStorage.getItem('playerOrder')) || [];
    const boardSize = 10;

    function createGameBoardLayout() {
        const layout = [];
        let index = 0;

        function addSquare(row, col, isStart = false, isFinish = false, isTrivia = false) {
            layout.push({ index: index++, row, col, isStart, isFinish, isTrivia });
        }

        // Top row (right to left)
        for (let col = boardSize - 1; col >= 0; col--) {
            addSquare(0, col, col === boardSize - 1, false, Math.random() < 0.1);
        }

        // Remaining rows (top to bottom, with a gap)
        for (let row = 1; row < boardSize; row++) {
            addSquare(row, 0, false, row === boardSize - 1, Math.random() < 0.1);
            for (let col = 1; col < boardSize; col++) {
                addSquare(row, col, false, false, Math.random() < 0.1);
            }
        }

        // Mark the final square as finish
        if (layout.length > 0) {
            layout[layout.length - 1].isFinish = true;
        }
        layout[0].isStart = true; // Ensure the first square is start

        return layout;
    }

    function connectWebSocket() {
        const backendUrl = 'YOUR_RENDER_BACKEND_URL'; // Replace with your Render backend URL
        const websocketUrl = backendUrl.replace(/^http(s?):\/\//, 'ws$1://');
        console.log('Connecting to WebSocket in game:', websocketUrl);

        ws = new WebSocket(websocketUrl);

        ws.onopen = () => {
            console.log('WebSocket connection established in game.');
        };

        ws.onmessage = handleWebSocketMessage;

        ws.onclose = () => {
            console.log('WebSocket connection closed in game.');
        };

        ws.onerror = (error) => {
            console.error('WebSocket error in game:', error);
        };
    }

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
            case 'updatePosition':
                playerPositions = data.playerPositions;
                updateBoard(playerPositions, boardContainer);
                updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
                break;
        }
    }

    function initializeBoard(boardLayout, container) {
        if (!container) return;
        container.innerHTML = '';
        boardSquares = [];
        container.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
        container.style.width = `${boardSize * 55}px`;
        container.style.height = `${boardSize * 55}px`;

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
                piece.style.backgroundColor = player.pieceColor;
                piece.textContent = player.username.substring(0, 2).toUpperCase();
                square.style.position = 'relative';
                piece.style.left = `${Math.random() * 60 + 10}%`;
                piece.style.top = `${Math.random() * 60 + 10}%`;
                square.appendChild(piece);
            }
        });
    }

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
        }
    }

    function handlePlayerWon(winnerId) {
        if (finishMessageDiv) {
            const winnerName = playersInLobby.find(p => p.playerId === winnerId)?.username || 'Someone';
            finishMessageDiv.textContent = winnerId === playerId ? 'You Won!' : `${winnerName} won!`;
            finishMessageDiv.style.display = 'block';
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
            playerPositions: playerPositions
        }));

        updateBoard(playerPositions, boardContainer);
        updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
    }

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

    connectWebSocket();
    initializeBoard(gameBoardLayout, boardContainer);
    updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
    updateRollDiceButtonState();
});
