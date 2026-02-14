/* Game controller -- ties board, effects, and chess.js together */
var Game = {
    chess: null,
    selected: null,
    moveHistory: [],

    init: function () {
        this.chess = new Chess();

        var self = this;
        ChessBoard.init('board', function (sq) { self.handleClick(sq); });
        Effects.init('effects');

        document.getElementById('reset').addEventListener('click', function () {
            self.reset();
        });

        this.render();
        this.updateStatus();
    },

    handleClick: function (sq) {
        var piece = this.chess.get(sq);

        if (this.selected) {
            // Try to make a move
            var moves = this.chess.moves({ square: this.selected, verbose: true });
            var targetMove = null;
            for (var i = 0; i < moves.length; i++) {
                if (moves[i].to === sq) {
                    targetMove = moves[i];
                    break;
                }
            }

            if (targetMove) {
                this.makeMove(targetMove);
                return;
            }

            // Deselect if clicking same square
            if (sq === this.selected) {
                ChessBoard.clearHighlights();
                this.selected = null;
                return;
            }
        }

        // Select piece if it belongs to current player
        if (piece && piece.color === this.chess.turn()) {
            this.selected = sq;
            var legalMoves = this.chess.moves({ square: sq, verbose: true });
            ChessBoard.select(sq);
            ChessBoard.showLegalMoves(legalMoves, this.chess.board());
        } else {
            ChessBoard.clearHighlights();
            this.selected = null;
        }
    },

    makeMove: function (move) {
        var fromPos = ChessBoard.getSquareCenter(move.from);
        var toPos = ChessBoard.getSquareCenter(move.to);
        var isCapture = !!move.captured;

        // Auto-promote to queen
        var result = this.chess.move({
            from: move.from,
            to: move.to,
            promotion: 'q'
        });

        if (!result) return;

        this.moveHistory.push({
            from: move.from,
            to: move.to,
            piece: move.piece,
            captured: move.captured || null,
            san: result.san,
            timestamp: Date.now()
        });

        // Visual effects
        Effects.addMoveTrail(fromPos, toPos);
        if (isCapture) {
            Effects.addCaptureEffect(toPos);
        }

        ChessBoard.clearHighlights();
        ChessBoard.showLastMove(move.from, move.to);
        this.selected = null;
        this.render();
        this.updateStatus();
        this.updateMoveList();

        // Check effect
        if (this.chess.in_check()) {
            var kingSquare = this._findKing(this.chess.turn());
            if (kingSquare) {
                Effects.addCheckEffect(ChessBoard.getSquareCenter(kingSquare));
            }
        }
    },

    _findKing: function (color) {
        var board = this.chess.board();
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var p = board[r][c];
                if (p && p.type === 'k' && p.color === color) {
                    return String.fromCharCode(97 + c) + (8 - r);
                }
            }
        }
        return null;
    },

    render: function () {
        ChessBoard.render(this.chess.board());
    },

    updateStatus: function () {
        var statusEl = document.getElementById('status');
        var turn = this.chess.turn() === 'w' ? 'White' : 'Black';

        if (this.chess.in_checkmate()) {
            var winner = this.chess.turn() === 'w' ? 'Black' : 'White';
            statusEl.textContent = 'Checkmate! ' + winner + ' wins';
            statusEl.style.color = '#ff6b6b';
        } else if (this.chess.in_draw()) {
            statusEl.textContent = 'Draw!';
            statusEl.style.color = '#ffd93d';
        } else if (this.chess.in_check()) {
            statusEl.textContent = turn + ' to move \u2014 Check!';
            statusEl.style.color = '#ff6b6b';
        } else {
            statusEl.textContent = turn + ' to move';
            statusEl.style.color = '#e0e0e0';
        }
    },

    updateMoveList: function () {
        var movesEl = document.getElementById('moves');
        var history = this.chess.history();
        var html = '';

        for (var i = 0; i < history.length; i += 2) {
            var num = Math.floor(i / 2) + 1;
            var white = history[i];
            var black = history[i + 1] || '';
            html += '<div class="move-pair">' +
                '<span class="move-number">' + num + '.</span>' +
                '<span class="move">' + white + '</span>' +
                '<span class="move">' + black + '</span>' +
                '</div>';
        }

        movesEl.innerHTML = html;
        movesEl.scrollTop = movesEl.scrollHeight;
    },

    reset: function () {
        this.chess.reset();
        this.selected = null;
        this.moveHistory = [];
        ChessBoard.clearHighlights();
        ChessBoard.lastMoveSquares = null;
        Effects.clear();
        document.getElementById('moves').innerHTML = '';
        this.render();
        this.updateStatus();

        // Clear last-move highlights from all squares
        var squares = document.querySelectorAll('.square.last-move');
        for (var i = 0; i < squares.length; i++) {
            squares[i].classList.remove('last-move');
        }
    }
};

document.addEventListener('DOMContentLoaded', function () {
    Game.init();
});
