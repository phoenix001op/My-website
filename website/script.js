const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const info = document.getElementById('info');
const restartBtn = document.getElementById('restart');
const playerSymbolSelect = document.getElementById('player-symbol');
const difficultySelect = document.getElementById('difficulty');
const winsEl = document.getElementById('wins');
const lossesEl = document.getElementById('losses');
const drawsEl = document.getElementById('draws');

let boardState = Array(9).fill(null);
let player = 'X';
let ai = 'O';
let isPlayerTurn = true;
let gameOver = false;

playerSymbolSelect.addEventListener('change', () => {
    player = playerSymbolSelect.value;
    ai = player === 'X' ? 'O' : 'X';
    restartGame();
});

difficultySelect.addEventListener('change', restartGame);
restartBtn.addEventListener('click', restartGame);

cells.forEach(cell => cell.addEventListener('click', () => {
    if (gameOver || !isPlayerTurn || cell.textContent) return;
    makeMove(cell.dataset.index, player);
    if (!checkGameOver()) aiMove();
}));

function makeMove(index, symbol) {
    boardState[index] = symbol;
    cells[index].textContent = symbol;
    isPlayerTurn = !isPlayerTurn;
    checkGameOver();
}

function aiMove() {
    if (gameOver) return;
    let index;
    const difficulty = difficultySelect.value;

    if (difficulty === 'easy') {
        const available = boardState.map((v,i)=>v===null?i:null).filter(v=>v!==null);
        index = available[Math.floor(Math.random()*available.length)];
    } else if (difficulty === 'medium') {
        if (Math.random() < 0.5) index = minimax(boardState, ai).index;
        else {
            const available = boardState.map((v,i)=>v===null?i:null).filter(v=>v!==null);
            index = available[Math.floor(Math.random()*available.length)];
        }
    } else {
        index = minimax(boardState, ai).index;
    }

    makeMove(index, ai);
}

function checkGameOver() {
    const winner = getWinner(boardState);
    if (winner) {
        gameOver = true;
        highlightWinner(winner.combination);
        info.textContent = winner.player === player ? "You Win!" : "AI Wins!";
        if (winner.player === player) winsEl.textContent = +winsEl.textContent + 1;
        else lossesEl.textContent = +lossesEl.textContent + 1;
        return true;
    } else if (!boardState.includes(null)) {
        gameOver = true;
        info.textContent = "Draw!";
        drawsEl.textContent = +drawsEl.textContent + 1;
        return true;
    } else {
        info.textContent = isPlayerTurn ? "Your turn!" : "AI's turn...";
        return false;
    }
}

function highlightWinner(combination) {
    combination.forEach(i => cells[i].classList.add('win'));
}

// Minimax algorithm
function minimax(newBoard, playerSymbol) {
    const availSpots = newBoard.map((v,i)=>v===null?i:null).filter(v=>v!==null);

    const winner = getWinner(newBoard);
    if (winner) {
        if (winner.player === ai) return {score: 10};
        else if (winner.player === player) return {score: -10};
    } else if (availSpots.length === 0) {
        return {score: 0};
    }

    const moves = [];
    for (let i = 0; i < availSpots.length; i++) {
        const move = {};
        move.index = availSpots[i];
        newBoard[availSpots[i]] = playerSymbol;

        if (playerSymbol === ai) {
            move.score = minimax(newBoard, player).score;
        } else {
            move.score = minimax(newBoard, ai).score;
        }

        newBoard[availSpots[i]] = null;
        moves.push(move);
    }

    let bestMove;
    if (playerSymbol === ai) {
        let bestScore = -Infinity;
        moves.forEach(m => { if (m.score > bestScore) { bestScore = m.score; bestMove = m; }});
    } else {
        let bestScore = Infinity;
        moves.forEach(m => { if (m.score < bestScore) { bestScore = m.score; bestMove = m; }});
    }

    return bestMove;
}

function getWinner(board) {
    const winCombinations = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];

    for (let comb of winCombinations) {
        const [a,b,c] = comb;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return {player: board[a], combination: comb};
        }
    }
    return null;
}

function restartGame() {
    boardState = Array(9).fill(null);
    cells.forEach(c => { c.textContent=''; c.classList.remove('win'); });
    gameOver = false;
    isPlayerTurn = true;
    info.textContent = "Your turn!";
}
const playAgainBtn = document.getElementById('play-again');

function checkGameOver() {
    const winner = getWinner(boardState);
    if (winner) {
        gameOver = true;
        highlightWinner(winner.combination);
        info.textContent = winner.player === player ? "You Win!" : "AI Wins!";
        if (winner.player === player) winsEl.textContent = +winsEl.textContent + 1;
        else lossesEl.textContent = +lossesEl.textContent + 1;

        playAgainBtn.style.display = "inline-block"; // show button
        return true;
    } else if (!boardState.includes(null)) {
        gameOver = true;
        info.textContent = "Draw!";
        drawsEl.textContent = +drawsEl.textContent + 1;

        playAgainBtn.style.display = "inline-block"; // show button
        return true;
    } else {
        info.textContent = isPlayerTurn ? "Your turn!" : "AI's turn...";
        return false;
    }
}

// Play Again button click
playAgainBtn.addEventListener('click', () => {
    restartGame();
    playAgainBtn.style.display = "none"; // hide button after restart
});