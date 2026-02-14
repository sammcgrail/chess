/* Board rendering and interaction */
var ChessBoard = {
    PIECES: {
        K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
        k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F'
    },

    el: null,
    squares: [],
    selected: null,
    highlighted: [],
    lastMoveSquares: null,
    onSquareClick: null,

    init: function (containerId, onSquareClick) {
        this.el = document.getElementById(containerId);
        this.onSquareClick = onSquareClick;
        this._createSquares();
    },

    _createSquares: function () {
        this.el.innerHTML = '';
        this.squares = [];

        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var div = document.createElement('div');
                var isLight = (r + c) % 2 === 0;
                div.className = 'square ' + (isLight ? 'light' : 'dark');

                var sq = this._toSq(r, c);
                div.dataset.square = sq;

                // File labels on bottom row
                if (r === 7) {
                    var fileLabel = document.createElement('span');
                    fileLabel.className = 'file-label';
                    fileLabel.textContent = String.fromCharCode(97 + c);
                    div.appendChild(fileLabel);
                }

                // Rank labels on left column
                if (c === 0) {
                    var rankLabel = document.createElement('span');
                    rankLabel.className = 'rank-label';
                    rankLabel.textContent = String(8 - r);
                    div.appendChild(rankLabel);
                }

                div.addEventListener('click', this._makeClickHandler(sq));
                this.el.appendChild(div);
                this.squares.push(div);
            }
        }
    },

    _makeClickHandler: function (sq) {
        var self = this;
        return function () {
            if (self.onSquareClick) self.onSquareClick(sq);
        };
    },

    _toSq: function (r, c) {
        return String.fromCharCode(97 + c) + (8 - r);
    },

    _fromSq: function (sq) {
        return { r: 8 - parseInt(sq[1]), c: sq.charCodeAt(0) - 97 };
    },

    _getEl: function (sq) {
        var pos = this._fromSq(sq);
        return this.squares[pos.r * 8 + pos.c];
    },

    render: function (position) {
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var el = this.squares[r * 8 + c];
                var piece = position[r][c];

                // Remove existing piece span (keep labels)
                var existing = el.querySelector('.piece');
                if (existing) existing.remove();

                if (piece) {
                    var key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
                    var span = document.createElement('span');
                    span.className = 'piece ' + (piece.color === 'w' ? 'white' : 'black');
                    span.textContent = this.PIECES[key];
                    el.appendChild(span);
                }
            }
        }
    },

    select: function (sq) {
        this.clearHighlights();
        this.selected = sq;
        this._getEl(sq).classList.add('selected');
    },

    showLegalMoves: function (moves, position) {
        for (var i = 0; i < moves.length; i++) {
            var move = moves[i];
            var el = this._getEl(move.to);
            var pos = this._fromSq(move.to);
            var hasPiece = position[pos.r][pos.c] !== null;
            el.classList.add(hasPiece ? 'legal-capture' : 'legal-move');
            this.highlighted.push(move.to);
        }
    },

    showLastMove: function (from, to) {
        if (this.lastMoveSquares) {
            this._getEl(this.lastMoveSquares.from).classList.remove('last-move');
            this._getEl(this.lastMoveSquares.to).classList.remove('last-move');
        }
        this.lastMoveSquares = { from: from, to: to };
        this._getEl(from).classList.add('last-move');
        this._getEl(to).classList.add('last-move');
    },

    clearHighlights: function () {
        if (this.selected) {
            this._getEl(this.selected).classList.remove('selected');
            this.selected = null;
        }
        for (var i = 0; i < this.highlighted.length; i++) {
            var el = this._getEl(this.highlighted[i]);
            el.classList.remove('legal-move', 'legal-capture');
        }
        this.highlighted = [];
    },

    getSquareCenter: function (sq) {
        var el = this._getEl(sq);
        var rect = el.getBoundingClientRect();
        var boardRect = this.el.getBoundingClientRect();
        return {
            x: rect.left - boardRect.left + rect.width / 2,
            y: rect.top - boardRect.top + rect.height / 2
        };
    }
};
