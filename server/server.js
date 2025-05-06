
// server/server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const port = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Store game states, lobbies, players, etc.
const lobbies = {};

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        try {
            const data = JSON.parse(message.toString());
            // Handle different types of messages from the client
            switch (data.type) {
                case 'createGame':
                    handleCreateGame(ws, data);
                    break;
                case 'joinGame':
                    handleJoinGame(ws, data);
                    break;
                case 'startGame':
                    handleStartGame(ws, data);
                    break;
                case 'rollDice':
                    handleRollDice(ws, data);
                    break;
                case 'answerTrivia':
                    handleAnswerTrivia(ws, data);
                    break;
                // ... other game actions
            }
        } catch (error) {
            console.error('Failed to parse message or handle action:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        // Handle player leaving (remove from lobby, game, etc.)
        handleDisconnect(ws);
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// --- Helper Functions (to be implemented below) ---
function generateGameCode() {
    // Implement logic to generate a unique game code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function handleCreateGame(ws, data) {
    const gameCode = generateGameCode();
    lobbies[gameCode] = {
        players: [],
        gameStarted: false,
        // ... other game state
    };
    joinLobby(ws, gameCode, data.username, data.pieceColor, true); // Creator joins immediately
}

function handleJoinGame(ws, data) {
    joinLobby(ws, data.gameCode, data.username, data.pieceColor, false);
}

function joinLobby(ws, gameCode, username, pieceColor, isCreator) {
    if (!lobbies[gameCode]) {
        ws.send(JSON.stringify({ type: 'lobbyError', message: 'Invalid game code.' }));
        return;
    }

    const lobby = lobbies[gameCode];

    if (lobby.players.length >= 10) {
        ws.send(JSON.stringify({ type: 'lobbyError', message: 'Lobby is full.' }));
        return;
    }

    if (lobby.players.some(player => player.username === username)) {
        ws.send(JSON.stringify({ type: 'lobbyError', message: 'Username already taken.' }));
        return;
    }

    if (lobby.players.some(player => player.pieceColor === pieceColor)) {
        ws.send(JSON.stringify({ type: 'lobbyError', message: 'Piece color already taken.' }));
        return;
    }

    const player = { ws, username, pieceColor, playerId: Date.now() }; // Simple unique ID
    lobby.players.push(player);
    ws.gameCode = gameCode; // Store game code on the WebSocket connection

    // Notify all players in the lobby about the new joiner
    broadcastLobbyUpdate(gameCode);

    // If the creator joined, send them the 'gameCreated' message
    if (isCreator) {
        ws.send(JSON.stringify({ type: 'gameCreated', gameCode }));
    }
}

function broadcastLobbyUpdate(gameCode) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        const playersInfo = lobby.players.map(p => ({ username: p.username, pieceColor: p.pieceColor, playerId: p.playerId }));
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'lobbyUpdate', players: playersInfo }));
        });
    }
}

function handleStartGame(ws, data) {
    const gameCode = ws.gameCode;
    const lobby = lobbies[gameCode];
    if (lobby && lobby.players.length > 1 && lobby.players.find(p => p.ws === ws)) { // Only creator can start
        lobby.gameStarted = true;
        lobby.currentPlayerIndex = 0; // Start with the first player who joined
        lobby.board = Array(205).fill(null); // Initialize the game board
        lobby.playerPositions = {};
        lobby.players.forEach(player => {
            lobby.playerPositions[player.playerId] = 0; // Start at square 0
        });
        broadcastGameStart(gameCode);
    }
}

function broadcastGameStart(gameCode) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'gameStarted', playerOrder: lobby.players.map(p => p.playerId), initialPositions: lobby.playerPositions }));
        });
        sendCurrentPlayerTurn(gameCode);
    }
}

function sendCurrentPlayerTurn(gameCode) {
    const lobby = lobbies[gameCode];
    if (lobby && lobby.gameStarted && lobby.players[lobby.currentPlayerIndex]) {
        const currentPlayerId = lobby.players[lobby.currentPlayerIndex].playerId;
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'currentPlayer', playerId: currentPlayerId }));
        });
    }
}

function handleRollDice(ws, data) {
    const gameCode = ws.gameCode;
    const lobby = lobbies[gameCode];
    if (lobby && lobby.gameStarted && lobby.players[lobby.currentPlayerIndex]?.ws === ws) {
        const roll = Math.floor(Math.random() * 6) + 1;
        const playerId = data.playerId;
        lobby.playerPositions[playerId] += roll;
        broadcastDiceRoll(gameCode, playerId, roll, lobby.playerPositions);

        // Check if landed on a special square
        if (lobby.playerPositions[playerId] % 10 === 0 && lobby.playerPositions[playerId] !== 0 && lobby.playerPositions[playerId] < 205) {
            sendTriviaQuestion(gameCode, playerId);
        } else if (lobby.playerPositions[playerId] >= 205) {
            handlePlayerWin(gameCode, playerId);
        } else {
            advanceTurn(gameCode);
        }
    }
}

function broadcastDiceRoll(gameCode, playerId, roll, playerPositions) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'diceRolled', playerId, roll, playerPositions }));
        });
    }
}

function sendTriviaQuestion(gameCode, playerId) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        // Implement logic to fetch a trivia question
        const question = { text: "What is the capital of France?", answer: "Paris" }; // Placeholder
        const player = lobby.players.find(p => p.playerId === playerId);
        if (player) {
            player.ws.send(JSON.stringify({ type: 'triviaQuestion', questionText: question.text }));
            lobby.currentQuestion = { question, playerId }; // Store current question
        }
    }
}

function handleAnswerTrivia(ws, data) {
    const gameCode = ws.gameCode;
    const lobby = lobbies[gameCode];
    if (lobby && lobby.currentQuestion && lobby.currentQuestion.playerId === data.playerId) {
        const isCorrect = data.answer.toLowerCase() === lobby.currentQuestion.question.answer.toLowerCase();
        ws.send(JSON.stringify({ type: 'triviaResult', correct: isCorrect, correctAnswer: lobby.currentQuestion.question.answer }));
        lobby.currentQuestion = null; // Clear the current question

        // Implement consequences for correct/incorrect answer (e.g., move again, stay put)
        if (isCorrect) {
            // Maybe allow another roll or continue turn
            advanceTurn(gameCode);
        } else {
            advanceTurn(gameCode);
        }
    }
}

function handlePlayerWin(gameCode, playerId) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        // Implement win handling: record finish time/order
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'playerWon', winnerId: playerId }));
        });
        // Potentially trigger podium display logic
    }
}

function advanceTurn(gameCode) {
    const lobby = lobbies[gameCode];
    if (lobby && lobby.gameStarted) {
        lobby.currentPlayerIndex = (lobby.currentPlayerIndex + 1) % lobby.players.length;
        sendCurrentPlayerTurn(gameCode);
    }
}

function handleDisconnect(ws) {
    // Implement logic to remove player from lobby and game state
    for (const gameCode in lobbies) {
        const lobby = lobbies[gameCode];
        lobby.players = lobby.players.filter(player => player.ws !== ws);
        if (lobby.players.length === 0) {
            delete lobbies[gameCode]; // Clean up empty lobbies
        } else {
            broadcastLobbyUpdate(gameCode);
        }
    }
}
// server/server.js (Continued)

    // ... (previous code) ...

    function handleStartGame(ws, data) {
        const gameCode = ws.gameCode;
        const lobby = lobbies[gameCode];
        if (lobby && lobby.players.length > 1 && lobby.players.find(p => p.ws === ws)) { // Only creator can start
            lobby.gameStarted = true;
            lobby.currentPlayerIndex = 0; // Start with the first player who joined
            lobby.board = Array(205).fill(null); // You might use this for special square markers later
            lobby.playerPositions = {};
            lobby.playerOrder = lobby.players.map(p => p.playerId); // Maintain order
            lobby.players.forEach(player => {
                lobby.playerPositions[player.playerId] = 0; // Start at square 0
            });
            lobby.finishOrder = []; // To track finishing order
            broadcastGameStart(gameCode);
        }
    }

    function broadcastGameStart(gameCode) {
        const lobby = lobbies[gameCode];
        if (lobby) {
            lobby.players.forEach(player => {
                player.ws.send(JSON.stringify({
                    type: 'gameStarted',
                    playerOrder: lobby.playerOrder,
                    initialPositions: lobby.playerPositions
                }));
            });
            sendCurrentPlayerTurn(gameCode);
        }
    }

    function sendCurrentPlayerTurn(gameCode) {
        const lobby = lobbies[gameCode];
        if (lobby && lobby.gameStarted && lobby.playerOrder[lobby.currentPlayerIndex]) {
            const currentPlayerId = lobby.playerOrder[lobby.currentPlayerIndex];
            lobby.players.forEach(player => {
                player.ws.send(JSON.stringify({ type: 'currentPlayer', playerId: currentPlayerId }));
            });
        }
    }

    function handleRollDice(ws, data) {
        const gameCode = ws.gameCode;
        const lobby = lobbies[gameCode];
        const playerId = data.playerId;

        if (lobby && lobby.gameStarted && lobby.playerOrder[lobby.currentPlayerIndex] === playerId) {
            const roll = Math.floor(Math.random() * 6) + 1;
            lobby.playerPositions[playerId] += roll;
            broadcastDiceRoll(gameCode, playerId, roll, lobby.playerPositions);

            const newPosition = lobby.playerPositions[playerId];
            if (newPosition >= 205) {
                handlePlayerWin(gameCode, playerId);
            } else if ((newPosition + 1) % 10 === 0 && newPosition !== 0 && newPosition < 200) {
                sendTriviaQuestion(gameCode, playerId);
            } else {
                advanceTurn(gameCode);
            }
        }
    }

    function broadcastDiceRoll(gameCode, playerId, roll, playerPositions) {
        const lobby = lobbies[gameCode];
        if (lobby) {
            lobby.players.forEach(player => {
                player.ws.send(JSON.stringify({ type: 'diceRolled', playerId, roll, playerPositions }));
            });
        }
    }

    // Placeholder for trivia questions - replace with your actual data source
    const triviaQuestions = [
        { text: "What is the capital of France?", answer: "Paris" },
        { text: "What is 2 + 2?", answer: "4" },
        // ... more questions
    ];

    function getRandomTriviaQuestion() {
        return triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    }

    function sendTriviaQuestion(gameCode, playerId) {
        const lobby = lobbies[gameCode];
        if (lobby) {
            const question = getRandomTriviaQuestion();
            const player = lobby.players.find(p => p.playerId === playerId);
            if (player) {
                player.ws.send(JSON.stringify({ type: 'triviaQuestion', questionText: question.text }));
                lobby.currentQuestion = { question, playerId };
            }
        }
    }

    function handleAnswerTrivia(ws, data) {
        const gameCode = ws.gameCode;
        const lobby = lobbies[gameCode];

        if (lobby && lobby.currentQuestion && lobby.currentQuestion.playerId === data.playerId) {
            const isCorrect = data.answer.trim().toLowerCase() === lobby.currentQuestion.question.answer.toLowerCase();
            ws.send(JSON.stringify({ type: 'triviaResult', correct: isCorrect, correctAnswer: lobby.currentQuestion.question.answer }));
            lobby.currentQuestion = null;

            // Advance turn regardless of the answer for this basic implementation
            advanceTurn(gameCode);
        }
    }

    function handlePlayerWin(gameCode, playerId) {
        const lobby = lobbies[gameCode];
        if (lobby && !lobby.finishOrder.includes(playerId)) {
            lobby.finishOrder.push(playerId);
            lobby.players.forEach(player => {
                player.ws.send(JSON.stringify({ type: 'playerWon', winnerId: playerId, finishOrder: lobby.finishOrder }));
            });
            if (lobby.finishOrder.length === lobby.players.length) {
                // Game over, show podium
                broadcastPodium(gameCode);
            }
        }
    }

    function broadcastPodium(gameCode) {
        const lobby = lobbies[gameCode];
        if (lobby) {
            const podiumPlayers = lobby.finishOrder.slice(0, 3).map(id => lobby.players.find(p => p.playerId === id));
            lobby.players.forEach(player => {
                player.ws.send(JSON.stringify({ type: 'showPodium', podiumPlayers }));
            });
        }
    }

    function advanceTurn(gameCode) {
        const lobby = lobbies[gameCode];
        if (lobby && lobby.gameStarted) {
            lobby.currentPlayerIndex = (lobby.currentPlayerIndex + 1) % lobby.playerOrder.length;
            sendCurrentPlayerTurn(gameCode);
        }
    }

    // ... (handleDisconnect function remains the same) ...
