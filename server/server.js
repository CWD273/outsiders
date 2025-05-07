// server/server.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const allTriviaQuestions = require('./trivia-questions'); // Import the questions

const app = express();
const port = process.env.PORT || 3000;

// Create an HTTP server from the Express app
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Store game states, lobbies, players, etc.
const lobbies = {};

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
        // ... other game state
    };
    joinLobby(ws, gameCode, data.username, data.pieceColor, true); // Creator joins immediately
}

// ... (rest of your server.js code remains the same, except for the `sendTriviaQuestion` function)

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

// ... (the rest of your server.js code)
