// server/server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const allTriviaQuestions = require('./trivia-questions'); // Import the questions

const app = express();
// Use the PORT environment variable provided by Render, or default to 3000 for local development
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
        const data = JSON.parse(message.toString());
        console.log('Server received:', data);

        switch (data.type) {
            case 'createGame':
                console.log('Handling createGame:', data.username, data.pieceColor);
                handleCreateGame(ws, data);
                break;
            case 'joinGame':
                console.log('Handling joinGame:', data.gameCode, data.username, data.pieceColor);
                handleJoinGame(ws, data);
                break;
            case 'startGame':
                console.log('Handling startGame for game:', ws.gameCode);
                handleStartGame(ws, data);
                break;
            case 'rollDice':
                console.log('Handling rollDice for player:', data.playerId, 'in game:', ws.gameCode);
                handleRollDice(ws, data);
                break;
            case 'answerTrivia':
                console.log('Handling answerTrivia for player:', data.playerId, 'in game:', ws.gameCode, 'answer:', data.answer);
                handleAnswerTrivia(ws, data);
                break;
            case 'disconnect':
                console.log('Client initiated disconnect');
                handleDisconnect(ws);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        handleDisconnect(ws);
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function handleCreateGame(ws, data) {
    const gameCode = generateGameCode();
    lobbies[gameCode] = {
        players: [],
        gameStarted: false,
        board: createGameBoard(), // Initialize the game board
        currentQuestionIndex: 0,
        usedQuestionIndices: [],
        currentPlayerIndex: 0,
        currentQuestion: null,
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

    const player = { ws, username, pieceColor, playerId: Date.now(), position: 0 }; // Add initial position
    lobby.players.push(player);
    ws.gameCode = gameCode; // Store game code on the WebSocket connection
    ws.playerId = player.playerId; // Store player ID on the WebSocket connection

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
        console.log('Start Game conditions met. Starting game for lobby:', gameCode);
        lobby.gameStarted = true;
        lobby.currentPlayerIndex = 0; // Start with the first player who joined
        lobby.players.forEach(player => {
            player.position = 0; // Initialize player positions
        });
        broadcastGameStart(gameCode, lobby.board, lobby.players.map(p => ({ playerId: p.playerId, position: p.position })));
    } else {
        console.log('Start Game conditions not met for lobby:', gameCode,
            'Lobby exists:', !!lobby,
            'Players > 1:', lobby?.players.length > 1,
            'Is creator:', lobby?.players.find(p => p.ws === ws) ? true : false
        );
    }
}

function broadcastGameStart(gameCode, board, initialPositions) {
    console.log('Broadcasting game start for game:', gameCode);
    const lobby = lobbies[gameCode];
    if (lobby) {
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'gameStarted', board, initialPositions: initialPositions.reduce((acc, curr) => { acc[curr.playerId] = curr.position; return acc; }, {}), playerOrder: lobby.players.map(p => p.playerId) }));
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
        const player = lobby.players.find(p => p.playerId === playerId);
        if (player) {
            player.position += roll;
            broadcastDiceRoll(gameCode, playerId, roll, lobby.players.map(p => ({ playerId: p.playerId, position: p.position })));

            const landedSquare = lobby.board.find(square => square.index === player.position);
            if (landedSquare && landedSquare.isTrivia) {
                sendTriviaQuestion(gameCode, playerId);
            } else if (player.position >= 204) { // Index 204 is the finish square
                handlePlayerWin(gameCode, playerId);
            } else {
                advanceTurn(gameCode);
            }
        }
    }
}

function broadcastDiceRoll(gameCode, playerId, roll, playerPositions) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'diceRolled', playerId, roll, playerPositions: playerPositions.reduce((acc, curr) => { acc[curr.playerId] = curr.position; return acc; }, {}) }));
        });
    }
}

function sendTriviaQuestion(gameCode, playerId) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        const availableQuestions = allTriviaQuestions.filter((_, index) => !lobby.usedQuestionIndices.includes(index));
        if (availableQuestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableQuestions.length);
            const question = availableQuestions[randomIndex];
            const originalIndex = allTriviaQuestions.indexOf(question);
            lobby.usedQuestionIndices.push(originalIndex);

            const player = lobby.players.find(p => p.playerId === playerId);
            if (player) {
                player.ws.send(JSON.stringify({ type: 'triviaQuestion', questionText: question.text }));
                lobby.currentQuestion = { question, playerId }; // Store current question
            }
        } else {
            // Handle the case where all questions have been used (optional: reshuffle?)
            console.log('All trivia questions have been used.');
            advanceTurn(gameCode); // Move to the next turn if no question is available
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
        advanceTurn(gameCode); // For now, just advance the turn regardless of the answer
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

// --- Game Board Generation ---
function createGameBoard() {
    const board = [];
    let index = 0;

    // Initial 50 squares
    for (let i = 0; i < 50; i++) {
        board.push({ index: index++, isTrivia: (i + 1) % 10 === 0 && i !== 0 });
    }

    // Next 49 squares going the opposite direction
    for (let i = 0; i < 49; i++) {
        board.push({ index: index++, isTrivia: (50 + i + 1) % 10 === 0 });
    }

    // Extend out 6 more squares
    for (let i = 0; i < 50; i++) {
        board.push({ index: index++, isTrivia: (99 + i + 1) % 10 === 0 });
    }

    // Next 49 squares going the opposite direction
    for (let i = 0; i < 49; i++) {
        board.push({ index: index++, isTrivia: (149 + i + 1) % 10 === 0 });
    }

    // Final 7 squares to reach 205
    for (let i = 0; i < 7; i++) {
        board.push({ index: index++ });
    }

    // Set start and finish squares
    board[0].isStart = true;
    board[204].isFinish = true;

    // Ensure exactly 20 trivia questions
    const triviaSquares = board.filter(square => square.isTrivia);
    while (triviaSquares.length > 20) {
        const randomIndex = Math.floor(Math.random() * triviaSquares.length);
        triviaSquares[randomIndex].isTrivia = false;
        triviaSquares.splice(randomIndex, 1);
    }
    while (triviaSquares.length < 20) {
        let randomIndex = Math.floor(Math.random() * board.length);
        if (!board[randomIndex].isTrivia && !board[randomIndex].isStart && !board[randomIndex].isFinish) {
            board[randomIndex].isTrivia = true;
            triviaSquares.push(board[randomIndex]);
        }
    }

    return board;
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
