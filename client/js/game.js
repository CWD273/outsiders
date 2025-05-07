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
    const newGameButton = document.getElementById('new-game-button'); // Assuming this button is also on game.html

    let ws;
    let gameCode = localStorage.getItem('gameCode'); // Retrieve gameCode if needed
    let playerId = localStorage.getItem('playerId');
    let playersInLobby = []; // You might need to fetch this again or store it
    let boardSquares = [];
    let playerPositions = JSON.parse(localStorage.getItem('initialPositions')) || {};
    let currentPlayerId = localStorage.getItem('currentPlayerId');
    let gameBoardLayout = JSON.parse(localStorage.getItem('boardLayout')) || [];
    let playerOrder = JSON.parse(localStorage.getItem('playerOrder')) || [];

    // --- WebSocket Connection ---
    function connectWebSocket() {
        const backendUrl = 'https://outsiders-49p8.onrender.com'; // Replace with your Render backend URL
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
            // Handle other game-specific messages if needed
        }
    }

    // --- Game Board Functions ---
    function initializeBoard(boardLayout, container) {
        if (!container) return;
        container.innerHTML = '';
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
        // Disable further actions
        if (rollDiceButton) rollDiceButton.disabled = true;
        if (submitAnswerButton) submitAnswerButton.disabled = true;
    }

    // --- Event Listeners ---
    if (rollDiceButton) {
        rollDiceButton.addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'rollDice', playerId: playerId }));
            rollDiceButton.disabled = true; // Disable until the server responds with the next turn
        });
    }

    if (submitAnswerButton) {
        submitAnswerButton.addEventListener('click', () => {
            const answer = triviaAnswerInput.value.trim();
            if (answer && triviaQuestionDiv.textContent) {
                ws.send(JSON.stringify({ type: 'answerTrivia', playerId: playerId, answer: answer }));
                triviaAnswerInput.value = ''; // Clear the input after sending
                submitAnswerButton.disabled = true; // Disable until the result is received
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
            // Clear other game-related localStorage if necessary
            window.location.href = 'index.html'; // Go back to the lobby
        });
    }

    // --- Initialization ---
    connectWebSocket();
    initializeBoard(gameBoardLayout, boardContainer);
    updateLeaderboard(playerPositions, playersInLobby, leaderboardUl);
    updateRollDiceButtonState(); // Set initial state based on current player
});
