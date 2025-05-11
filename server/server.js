// server/server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const allTriviaQuestions = require('./trivia-questions'); // Import the questions

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const lobbies = {};
const BOARD_LENGTH = 120;
const TRIVIA_INTERVAL = 5;
const NUM_TRIVIA_QUESTIONS = 20; // Adjust as needed

function createGameBoard() {
    const board = Array(BOARD_LENGTH).fill(null).map((_, index) => ({
        index: index,
        isTrivia: (index + 1) % TRIVIA_INTERVAL === 0 && index !== 0
    }));
    board[0].isStart = true;
    board[BOARD_LENGTH - 1].isFinish = true;

    // Ensure a specific number of trivia questions (optional, adjust logic as needed)
    const triviaSquares = board.filter(square => square.isTrivia);
    while (triviaSquares.length < NUM_TRIVIA_QUESTIONS) {
        const randomIndex = Math.floor(Math.random() * board.length);
        if (!board[randomIndex].isTrivia && !board[randomIndex].isStart && !board[randomIndex].isFinish) {
            board[randomIndex].isTrivia = true;
            triviaSquares.push(board[randomIndex]);
        }
    }
    while (triviaSquares.length > NUM_TRIVIA_QUESTIONS) {
        const randomIndex = Math.floor(Math.random() * triviaSquares.length);
        triviaSquares[randomIndex].isTrivia = false;
        triviaSquares.splice(randomIndex, 1);
    }

    return board;
}

function getRandomTriviaQuestion(lobby) {
    const availableQuestions = allTriviaQuestions.filter((_, index) => !lobby.usedQuestionIndices.includes(index));
    if (availableQuestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const question = availableQuestions[randomIndex];
        const originalIndex = allTriviaQuestions.indexOf(question);
        lobby.usedQuestionIndices.push(originalIndex);
        return question;
    }
    return null;
}

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        const data = JSON.parse(message.toString());
        console.log('Server received:', data);

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
                handleRollDice(ws,data);
                break;
            case 'answerTrivia':
                handleAnswerTrivia(ws, data);
                break;
            case 'disconnect':
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
        board: createGameBoard(),
        currentPlayerIndex: 0,
        usedQuestionIndices: [],
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

    const player = { ws, username, pieceColor, playerId: Date.now(), position: 0 };
    lobby.players.push(player);
    ws.gameCode = gameCode;
    ws.playerId = player.playerId;

    broadcastLobbyUpdate(gameCode);

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
    if (lobby && lobby.players.length > 1 && lobby.players.find(p => p.ws === ws)) {
        console.log('Start Game conditions met. Starting game for lobby:', gameCode);
        lobby.gameStarted = true;
        lobby.currentPlayerIndex = 0;
        lobby.players.forEach(player => {
            player.position = 0;
        });
        const initialPositions = lobby.players.reduce((acc, player) => {
            acc[player.playerId] = player.position;
            return acc;
        }, {});
        const playerOrder = lobby.players.map(p => p.playerId);
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'gameStarted', board: lobby.board, initialPositions, playerOrder }));
        });
        sendCurrentPlayerTurn(gameCode);
    } else {
        console.log('Start Game conditions not met for lobby:', gameCode,
            'Lobby exists:', !!lobby,
            'Players > 1:', lobby?.players.length > 1,
            'Is creator:', lobby?.players.find(p => p.ws === ws) ? true : false
        );
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
        const roll = Math.floor(Math.random() * 10) + 1;
        const playerId = data.playerId;
        const player = lobby.players.find(p => p.playerId === playerId);
        if (player) {
            player.position += roll;
            const playerPositions = lobby.players.reduce((acc, p) => {
                acc[p.playerId] = p.position;
                return acc;
            }, {});
            lobby.players.forEach(p => {
                p.ws.send(JSON.stringify({ type: 'diceRolled', playerId, roll, playerPositions }));
            });

            const landedSquareIndex = player.position;
            const landedSquare = lobby.board.find(square => square.index === landedSquareIndex);
            if (landedSquare && landedSquare.isTrivia) {
                const question = getRandomTriviaQuestion(lobby);
                if (question) {
                    player.ws.send(JSON.stringify({ type: 'triviaQuestion', questionText: question.text, choices: shuffleArray(question.choices), image: question.image }));
                    lobby.currentQuestion = { question, playerId };
                } else {
                    console.log('No more trivia questions available.');
                    advanceTurn(gameCode);
                }
            } else if (landedSquareIndex >= BOARD_LENGTH - 1) {
                handlePlayerWin(gameCode, playerId);
            } else {
                advanceTurn(gameCode);
            }
        }
    }
}

function handleAnswerTrivia(ws, data) {
    const gameCode = ws.gameCode;
    const lobby = lobbies[gameCode];
    if (lobby && lobby.currentQuestion && lobby.currentQuestion.playerId === data.playerId) {
        const isCorrect = data.answer.toLowerCase() === lobby.currentQuestion.question.correctAnswer.toLowerCase();
        ws.send(JSON.stringify({ type: 'triviaResult', correct: isCorrect, correctAnswer: lobby.currentQuestion.question.correctAnswer }));

        const player = lobby.players.find(p => p.playerId === data.playerId);
        if (player) {
            if (isCorrect) {
                player.position += 5;
            } else {
                player.position -= 5;
                if (player.position < 0) player.position = 0;
            }
            const playerPositions = lobby.players.reduce((acc, p) => {
                acc[p.playerId] = p.position;
                return acc;
            }, {});
            lobby.players.forEach(p => {
                p.ws.send(JSON.stringify({ type: 'playerPositionsUpdate', playerPositions }));
            });

            const landedSquareIndex = player.position;
            if (landedSquareIndex >= BOARD_LENGTH - 1) {
                handlePlayerWin(gameCode, data.playerId);
            } else {
                advanceTurn(gameCode);
            }
        }
        lobby.currentQuestion = null;
    }
}

function handlePlayerWin(gameCode, playerId) {
    const lobby = lobbies[gameCode];
    if (lobby) {
        lobby.players.forEach(player => {
            player.ws.send(JSON.stringify({ type: 'playerWon', winnerId: playerId }));
        });
        // Optionally, you could clean up the lobby after the game ends
        // delete lobbies[gameCode];
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
            delete lobbies[gameCode];
        } else {
            broadcastLobbyUpdate(gameCode);
        }
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
