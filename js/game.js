/* Game controller – ties Board3D and chess.js together */
var Game = {
    chess: null,
    selected: null,
    moveHistory: [],

    init: function () {
        this.chess = new Chess();

        var self = this;
        Board3D.init('scene-container', function (sq) { self.handleClick(sq); });

        document.getElementById('reset').addEventListener('click', function () {
            self.reset();
        });

        this.render();
        this.updateStatus();
    },

    handleClick: function (sq) {
        var piece = this.chess.get(sq);

        if (this.selected) {
            var moves = this.chess.moves({ square: this.selected, verbose: true });
            var targetMove = null;
            for (var i = 0; i < moves.length; i++) {
                if (moves[i].to === sq) { targetMove = moves[i]; break; }
            }

            if (targetMove) { this.makeMove(targetMove); return; }

            if (sq === this.selected) {
                Board3D.clearHighlights();
                this.selected = null;
                return;
            }
        }

        if (piece && piece.color === this.chess.turn()) {
            this.selected = sq;
            var legalMoves = this.chess.moves({ square: sq, verbose: true });
            Board3D.select(sq);
            Board3D.showLegalMoves(legalMoves, this.chess.board());
        } else {
            Board3D.clearHighlights();
            this.selected = null;
        }
    },

    makeMove: function (move) {
        var isWhite = this.chess.turn() === 'w';

        // Snapshot board BEFORE move for history layer
        var boardBefore = this._cloneBoard();

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
            isWhite: isWhite
        });

        // 3D: add history layer (pre-move snapshot) with connecting line
        Board3D.addHistorySnapshot(boardBefore, move.from, move.to, isWhite);

        // 3D: persistent move line on current board
        Board3D.addMoveLine(move.from, move.to, isWhite);

        Board3D.clearHighlights();
        Board3D.showLastMove(move.from, move.to);
        this.selected = null;
        this.render();
        this.updateStatus();
        this.updateMoveList();
    },

    _cloneBoard: function () {
        var board = this.chess.board();
        var clone = [];
        for (var r = 0; r < 8; r++) {
            clone[r] = [];
            for (var c = 0; c < 8; c++) {
                var p = board[r][c];
                clone[r][c] = p ? { type: p.type, color: p.color } : null;
            }
        }
        return clone;
    },

    render: function () {
        Board3D.render(this.chess.board());
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
        Board3D.clearAll();
        document.getElementById('moves').innerHTML = '';
        this.render();
        this.updateStatus();
    }
};

document.addEventListener('DOMContentLoaded', function () {
    Game.init();
});
