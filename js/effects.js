/* Canvas effects overlay for move animations */
var Effects = {
    canvas: null,
    ctx: null,
    effects: [],

    init: function (canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this._resize();

        var self = this;
        var ro = new ResizeObserver(function () { self._resize(); });
        ro.observe(this.canvas.parentElement);

        this._loop();
    },

    _resize: function () {
        var parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    },

    _loop: function () {
        var self = this;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.effects = this.effects.filter(function (effect) {
            effect.update();
            effect.draw(self.ctx);
            return !effect.done;
        });

        requestAnimationFrame(function () { self._loop(); });
    },

    addMoveTrail: function (from, to) {
        this.effects.push(new MoveTrail(from, to));
    },

    addCaptureEffect: function (pos) {
        this.effects.push(new CaptureEffect(pos));
    },

    addCheckEffect: function (pos) {
        this.effects.push(new CheckEffect(pos));
    },

    clear: function () {
        this.effects = [];
    }
};

/* Trail of light along a piece's move path */
function MoveTrail(from, to) {
    this.particles = [];
    this.done = false;
    this.age = 0;
    this.maxAge = 50;

    var steps = 18;
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        this.particles.push({
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            alpha: 1,
            size: 2.5 + Math.sin(t * Math.PI) * 3
        });
    }
}

MoveTrail.prototype.update = function () {
    this.age++;
    var fadeStart = this.maxAge * 0.3;

    for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        if (this.age > fadeStart) {
            p.alpha = Math.max(0, 1 - (this.age - fadeStart) / (this.maxAge - fadeStart));
        }
    }

    if (this.age >= this.maxAge) this.done = true;
};

MoveTrail.prototype.draw = function (ctx) {
    // Connecting line
    if (this.particles.length > 1 && this.particles[0].alpha > 0) {
        ctx.beginPath();
        ctx.moveTo(this.particles[0].x, this.particles[0].y);
        for (var i = 1; i < this.particles.length; i++) {
            ctx.lineTo(this.particles[i].x, this.particles[i].y);
        }
        ctx.strokeStyle = 'rgba(100, 180, 255, ' + (this.particles[0].alpha * 0.3) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Particles
    for (var j = 0; j < this.particles.length; j++) {
        var p = this.particles[j];
        if (p.alpha <= 0) continue;

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 180, 255, ' + (p.alpha * 0.15) + ')';
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(140, 200, 255, ' + (p.alpha * 0.6) + ')';
        ctx.fill();
    }
};

/* Burst of particles on capture */
function CaptureEffect(pos) {
    this.particles = [];
    this.done = false;
    this.age = 0;
    this.maxAge = 40;

    for (var i = 0; i < 14; i++) {
        var angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4;
        var speed = 1.5 + Math.random() * 3;
        this.particles.push({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            size: 2 + Math.random() * 3
        });
    }
}

CaptureEffect.prototype.update = function () {
    this.age++;
    for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha = Math.max(0, 1 - this.age / this.maxAge);
        p.size *= 0.98;
    }
    if (this.age >= this.maxAge) this.done = true;
};

CaptureEffect.prototype.draw = function (ctx) {
    for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        if (p.alpha <= 0) continue;

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 150, 80, ' + (p.alpha * 0.2) + ')';
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 100, 80, ' + (p.alpha * 0.8) + ')';
        ctx.fill();
    }
};

/* Pulsing ring on check */
function CheckEffect(pos) {
    this.pos = pos;
    this.done = false;
    this.age = 0;
    this.maxAge = 60;
    this.maxRadius = 35;
}

CheckEffect.prototype.update = function () {
    this.age++;
    if (this.age >= this.maxAge) this.done = true;
};

CheckEffect.prototype.draw = function (ctx) {
    var t = this.age / this.maxAge;
    var radius = this.maxRadius * t;
    var alpha = (1 - t) * 0.7;

    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 80, 80, ' + alpha + ')';
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.stroke();

    // Inner glow
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 80, 80, ' + (alpha * 0.15) + ')';
    ctx.fill();
};
