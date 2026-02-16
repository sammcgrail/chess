/* Three.js 3D Chess Board with layered history and glow lines */
var Board3D = {
    scene: null, camera: null, renderer: null, controls: null,
    raycaster: null, mouse: null, container: null,

    currentBoardGroup: null,
    squareMeshes: [],
    pieceMeshes: [],
    highlightMeshes: [],
    lastMoveHL: [],
    selected: null,
    onSquareClick: null,

    historyLayers: [],
    moveLineGroup: null,
    interLayerGroup: null,
    particleSystem: null,

    _texCache: {},
    _clock: null,
    _downPos: null,

    LAYER_GAP: 2.8,
    MAX_LAYERS: 16,

    PIECE_CHARS: {
        K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
        k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F'
    },

    init: function (containerId, onSquareClick) {
        this.onSquareClick = onSquareClick;
        this.container = document.getElementById(containerId);
        this._clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x080818);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x080818, 0.012);

        // Camera
        var aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
        this.camera.position.set(0, 13, 10);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 45;
        this.controls.maxPolarAngle = Math.PI * 0.85;
        this.controls.target.set(0, 0, 0);

        this._setupLights();
        this._createBoard();

        this.moveLineGroup = new THREE.Group();
        this.scene.add(this.moveLineGroup);
        this.interLayerGroup = new THREE.Group();
        this.scene.add(this.interLayerGroup);

        this._createFloor();
        this._createParticles();

        // Click detection (distinguish from orbit drag)
        var self = this;
        this.renderer.domElement.addEventListener('pointerdown', function (e) {
            self._downPos = { x: e.clientX, y: e.clientY };
        });
        this.renderer.domElement.addEventListener('pointerup', function (e) {
            if (!self._downPos) return;
            var dx = e.clientX - self._downPos.x;
            var dy = e.clientY - self._downPos.y;
            if (dx * dx + dy * dy < 36) self._onClick(e);
            self._downPos = null;
        });
        window.addEventListener('resize', function () { self._onResize(); });

        this._animate();
    },

    /* ── Lights ── */
    _setupLights: function () {
        this.scene.add(new THREE.AmbientLight(0x404060, 0.5));

        var dir = new THREE.DirectionalLight(0xffffff, 0.7);
        dir.position.set(5, 15, 8);
        dir.castShadow = true;
        dir.shadow.mapSize.set(2048, 2048);
        dir.shadow.camera.left = -10; dir.shadow.camera.right = 10;
        dir.shadow.camera.top = 10;  dir.shadow.camera.bottom = -10;
        dir.shadow.camera.near = 1;  dir.shadow.camera.far = 40;
        this.scene.add(dir);

        var p1 = new THREE.PointLight(0x4466ff, 0.5, 35);
        p1.position.set(-8, 7, -8);
        this.scene.add(p1);

        var p2 = new THREE.PointLight(0xff6644, 0.35, 35);
        p2.position.set(8, 7, 8);
        this.scene.add(p2);
    },

    /* ── Board ── */
    _createBoard: function () {
        this.currentBoardGroup = new THREE.Group();
        this.squareMeshes = [];

        // Base
        var base = new THREE.Mesh(
            new THREE.BoxGeometry(8.6, 0.18, 8.6),
            new THREE.MeshStandardMaterial({ color: 0x15152a, metalness: 0.7, roughness: 0.3 })
        );
        base.position.y = -0.14;
        base.receiveShadow = true;
        this.currentBoardGroup.add(base);

        // Edge trim
        var trim = new THREE.Mesh(
            new THREE.BoxGeometry(8.8, 0.06, 8.8),
            new THREE.MeshStandardMaterial({ color: 0x3333666, metalness: 0.9, roughness: 0.2 })
        );
        trim.position.y = -0.24;
        this.currentBoardGroup.add(trim);

        // Squares
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var isLight = (r + c) % 2 === 0;
                var mat = new THREE.MeshStandardMaterial({
                    color: isLight ? 0x7575a8 : 0x44446e,
                    metalness: 0.15,
                    roughness: 0.75
                });
                var mesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.07, 0.96), mat);
                mesh.position.set(c - 3.5, 0, r - 3.5);
                mesh.receiveShadow = true;
                mesh.userData = { square: this._toSq(r, c), row: r, col: c, origColor: mat.color.getHex() };
                this.squareMeshes.push(mesh);
                this.currentBoardGroup.add(mesh);
            }
        }

        this._createLabels();
        this.scene.add(this.currentBoardGroup);
    },

    _createLabels: function () {
        var files = 'abcdefgh';
        for (var i = 0; i < 8; i++) {
            var f = this._textSprite(files[i], '#7777aa');
            f.position.set(i - 3.5, 0.05, 4.4);
            f.scale.set(0.35, 0.35, 0.35);
            this.currentBoardGroup.add(f);

            var rk = this._textSprite(String(8 - i), '#7777aa');
            rk.position.set(-4.4, 0.05, i - 3.5);
            rk.scale.set(0.35, 0.35, 0.35);
            this.currentBoardGroup.add(rk);
        }
    },

    _textSprite: function (text, color) {
        var c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        var ctx = c.getContext('2d');
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(text, 32, 32);
        return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    },

    /* ── Floor & Particles ── */
    _createFloor: function () {
        var g = new THREE.GridHelper(60, 60, 0x222244, 0x111133);
        g.position.y = -0.3;
        g.material.transparent = true;
        g.material.opacity = 0.15;
        this.scene.add(g);
    },

    _createParticles: function () {
        var n = 300;
        var pos = new Float32Array(n * 3);
        var sizes = new Float32Array(n);
        for (var i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 50;
            pos[i * 3 + 1] = Math.random() * 25 - 8;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
            sizes[i] = 0.04 + Math.random() * 0.08;
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        var mat = new THREE.PointsMaterial({
            color: 0x6688cc, size: 0.07, transparent: true,
            opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
        });
        this.particleSystem = new THREE.Points(geo, mat);
        this.scene.add(this.particleSystem);
    },

    /* ── Coord helpers ── */
    _toSq: function (r, c) { return String.fromCharCode(97 + c) + (8 - r); },
    _fromSq: function (sq) { return { r: 8 - parseInt(sq[1]), c: sq.charCodeAt(0) - 97 }; },
    _sqToWorld: function (sq, y) {
        var p = this._fromSq(sq);
        return new THREE.Vector3(p.c - 3.5, y || 0, p.r - 3.5);
    },

    /* ── Piece textures ── */
    _pieceTexture: function (symbol, isWhite) {
        var key = symbol + (isWhite ? 'w' : 'b');
        if (this._texCache[key]) return this._texCache[key];
        var s = 256, c = document.createElement('canvas');
        c.width = s; c.height = s;
        var ctx = c.getContext('2d');
        ctx.clearRect(0, 0, s, s);
        ctx.font = (s * 0.78) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isWhite) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#f0ece0';
            ctx.fillText(symbol, s / 2, s / 2);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(40,30,10,0.25)';
            ctx.lineWidth = 1.5;
            ctx.strokeText(symbol, s / 2, s / 2);
        } else {
            // Black pieces: solid dark fill with clear light outline
            ctx.shadowColor = 'rgba(80,80,140,0.5)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#303048';
            ctx.fillText(symbol, s / 2, s / 2);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#aaaacc';
            ctx.lineWidth = 2.5;
            ctx.strokeText(symbol, s / 2, s / 2);
        }
        var tex = new THREE.CanvasTexture(c);
        this._texCache[key] = tex;
        return tex;
    },

    /* ── Render pieces ── */
    render: function (position) {
        var i;
        for (i = 0; i < this.pieceMeshes.length; i++) this.currentBoardGroup.remove(this.pieceMeshes[i]);
        this.pieceMeshes = [];
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var piece = position[r][c];
                if (!piece) continue;
                var isW = piece.color === 'w';
                var chKey = isW ? piece.type.toUpperCase() : piece.type;
                var tex = this._pieceTexture(this.PIECE_CHARS[chKey], isW);
                var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                sprite.position.set(c - 3.5, 0.55, r - 3.5);
                sprite.scale.set(0.88, 0.88, 0.88);
                this.pieceMeshes.push(sprite);
                this.currentBoardGroup.add(sprite);
            }
        }
    },

    /* ── Highlights ── */
    select: function (sq) {
        this.clearHighlights();
        this.selected = sq;
        var pos = this._fromSq(sq);
        var m = this.squareMeshes[pos.r * 8 + pos.c];
        m.material.color.setHex(0xbba030);
        m.material.emissive = new THREE.Color(0x554410);
        this.highlightMeshes.push({ type: 'sq', mesh: m });
    },

    showLegalMoves: function (moves, position) {
        for (var i = 0; i < moves.length; i++) {
            var p = this._fromSq(moves[i].to);
            var hasPiece = position[p.r][p.c] !== null;
            var geo = hasPiece ? new THREE.RingGeometry(0.34, 0.44, 32) : new THREE.CircleGeometry(0.14, 32);
            var mat = new THREE.MeshBasicMaterial({
                color: 0xffdd44, transparent: true, opacity: 0.5,
                side: THREE.DoubleSide, depthWrite: false
            });
            var ind = new THREE.Mesh(geo, mat);
            ind.rotation.x = -Math.PI / 2;
            ind.position.set(p.c - 3.5, 0.06, p.r - 3.5);
            this.currentBoardGroup.add(ind);
            this.highlightMeshes.push({ type: 'ind', mesh: ind });
        }
    },

    showLastMove: function (from, to) {
        var i;
        for (i = 0; i < this.lastMoveHL.length; i++) this.currentBoardGroup.remove(this.lastMoveHL[i]);
        this.lastMoveHL = [];
        var sqs = [from, to];
        for (i = 0; i < 2; i++) {
            var pos = this._fromSq(sqs[i]);
            var pl = new THREE.Mesh(
                new THREE.PlaneGeometry(0.96, 0.96),
                new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
            );
            pl.rotation.x = -Math.PI / 2;
            pl.position.set(pos.c - 3.5, 0.055, pos.r - 3.5);
            this.currentBoardGroup.add(pl);
            this.lastMoveHL.push(pl);
        }
    },

    clearHighlights: function () {
        for (var i = 0; i < this.highlightMeshes.length; i++) {
            var h = this.highlightMeshes[i];
            if (h.type === 'sq') {
                h.mesh.material.color.setHex(h.mesh.userData.origColor);
                h.mesh.material.emissive = new THREE.Color(0);
            } else {
                this.currentBoardGroup.remove(h.mesh);
            }
        }
        this.highlightMeshes = [];
        this.selected = null;
    },

    /* ── Persistent move lines on current board ── */
    addMoveLine: function (fromSq, toSq, isWhite) {
        var a = this._sqToWorld(fromSq, 0.09);
        var b = this._sqToWorld(toSq, 0.09);
        var col = isWhite ? 0x4488ff : 0xff7744;
        this.moveLineGroup.add(this._glowTube(a, b, col, 0.018, 0.07, false));
    },

    /* ── History layers ── */
    addHistorySnapshot: function (position, moveFrom, moveTo, isWhite) {
        var layerGroup = this._createHistoryBoard(position);
        layerGroup.userData.moveFrom = moveFrom;
        layerGroup.userData.moveTo = moveTo;
        layerGroup.userData.isWhite = isWhite;

        this.historyLayers.unshift(layerGroup);
        this.scene.add(layerGroup);

        while (this.historyLayers.length > this.MAX_LAYERS) {
            this.scene.remove(this.historyLayers.pop());
        }

        this._updateLayers();
    },

    _updateLayers: function () {
        var i, j;
        // Position layers & set opacity
        for (i = 0; i < this.historyLayers.length; i++) {
            this.historyLayers[i].position.y = -(i + 1) * this.LAYER_GAP;
            var op = Math.max(0.06, 0.38 - i * 0.022);
            this._setGroupOpacity(this.historyLayers[i], op);
        }

        // Adjust camera target slightly downward
        var depth = Math.min(this.historyLayers.length, 6) * this.LAYER_GAP;
        this.controls.target.y = -depth * 0.12;

        // Rebuild inter-layer lines
        while (this.interLayerGroup.children.length) {
            var c = this.interLayerGroup.children[0];
            this.interLayerGroup.remove(c);
        }

        for (j = 0; j < this.historyLayers.length; j++) {
            var layer = this.historyLayers[j];
            var fromSq = layer.userData.moveFrom;
            var toSq = layer.userData.moveTo;
            var isW = layer.userData.isWhite;

            var fromY = layer.position.y + 0.1;
            var toY = j === 0 ? 0.1 : this.historyLayers[j - 1].position.y + 0.1;

            var fromW = this._sqToWorld(fromSq, fromY);
            var toW = this._sqToWorld(toSq, toY);
            var lineCol = isW ? 0x44ddff : 0xffaa33;

            this.interLayerGroup.add(this._glowTube(fromW, toW, lineCol, 0.028, 0.12, true));
        }
    },

    _createHistoryBoard: function (position) {
        var group = new THREE.Group();

        // Transparent base
        var base = new THREE.Mesh(
            new THREE.BoxGeometry(8.2, 0.03, 8.2),
            new THREE.MeshStandardMaterial({ color: 0x15152a, transparent: true, opacity: 0.25, metalness: 0.5, roughness: 0.5 })
        );
        group.add(base);

        // Squares
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var isLight = (r + c) % 2 === 0;
                var m = new THREE.Mesh(
                    new THREE.BoxGeometry(0.93, 0.025, 0.93),
                    new THREE.MeshStandardMaterial({
                        color: isLight ? 0x7575a8 : 0x44446e,
                        transparent: true, opacity: 0.2, metalness: 0.15, roughness: 0.8
                    })
                );
                m.position.set(c - 3.5, 0, r - 3.5);
                group.add(m);
            }
        }

        // Pieces
        for (var r2 = 0; r2 < 8; r2++) {
            for (var c2 = 0; c2 < 8; c2++) {
                var piece = position[r2][c2];
                if (!piece) continue;
                var isW = piece.color === 'w';
                var chKey = isW ? piece.type.toUpperCase() : piece.type;
                var tex = this._pieceTexture(this.PIECE_CHARS[chKey], isW);
                var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false }));
                sp.position.set(c2 - 3.5, 0.3, r2 - 3.5);
                sp.scale.set(0.7, 0.7, 0.7);
                group.add(sp);
            }
        }

        return group;
    },

    _setGroupOpacity: function (group, opacity) {
        group.traverse(function (child) {
            if (child.material && child.material.transparent) {
                child.material.opacity = child.isSprite ? opacity * 1.1 : opacity;
            }
        });
    },

    /* ── Glow tube helper ── */
    _glowTube: function (from, to, color, coreR, glowR, arc) {
        var group = new THREE.Group();
        var curve;

        if (arc) {
            // Arced line with midpoint pushed outward
            var mid = new THREE.Vector3().lerpVectors(from, to, 0.5);
            var hDir = new THREE.Vector2(mid.x, mid.z);
            var hLen = hDir.length();
            if (hLen > 0.01) {
                hDir.normalize();
                mid.x += hDir.x * 0.7;
                mid.z += hDir.y * 0.7;
            }
            curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        } else {
            curve = new THREE.LineCurve3(from, to);
        }

        var segs = arc ? 24 : 8;

        // Outer glow
        group.add(new THREE.Mesh(
            new THREE.TubeGeometry(curve, segs, glowR, 8, false),
            new THREE.MeshBasicMaterial({
                color: color, transparent: true, opacity: 0.1,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
            })
        ));

        // Mid glow
        group.add(new THREE.Mesh(
            new THREE.TubeGeometry(curve, segs, glowR * 0.45, 8, false),
            new THREE.MeshBasicMaterial({
                color: color, transparent: true, opacity: 0.22,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
            })
        ));

        // Core
        group.add(new THREE.Mesh(
            new THREE.TubeGeometry(curve, segs, coreR, 8, false),
            new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.75,
                blending: THREE.AdditiveBlending, depthWrite: false
            })
        ));

        // Endpoint spheres
        var sphereGeo = new THREE.SphereGeometry(coreR * 2.2, 12, 12);
        var sphereMat = new THREE.MeshBasicMaterial({
            color: color, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        var s1 = new THREE.Mesh(sphereGeo, sphereMat);
        s1.position.copy(from);
        group.add(s1);
        var s2 = new THREE.Mesh(sphereGeo.clone(), sphereMat.clone());
        s2.position.copy(to);
        group.add(s2);

        return group;
    },

    /* ── Click ── */
    _onClick: function (event) {
        var rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        var hits = this.raycaster.intersectObjects(this.squareMeshes);
        if (hits.length > 0 && this.onSquareClick) {
            this.onSquareClick(hits[0].object.userData.square);
        }
    },

    /* ── Resize ── */
    _onResize: function () {
        var w = this.container.clientWidth, h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    },

    /* ── Animation loop ── */
    _animate: function () {
        var self = this;
        requestAnimationFrame(function () { self._animate(); });

        var t = this._clock.getElapsedTime();
        this.controls.update();

        // Particle drift
        if (this.particleSystem) {
            var pa = this.particleSystem.geometry.attributes.position.array;
            for (var i = 1; i < pa.length; i += 3) {
                pa[i] += Math.sin(t * 0.5 + i) * 0.001;
            }
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            this.particleSystem.rotation.y = t * 0.008;
        }

        // Pulse glow on inter-layer lines
        var pulse = 0.7 + 0.3 * Math.sin(t * 2.5);
        this.interLayerGroup.traverse(function (child) {
            if (child.isMesh && child.material && child.material.opacity <= 0.12) {
                child.material.opacity = 0.1 * pulse;
            }
        });

        this.renderer.render(this.scene, this.camera);
    },

    /* ── Clear all ── */
    clearAll: function () {
        var i;
        for (i = 0; i < this.historyLayers.length; i++) this.scene.remove(this.historyLayers[i]);
        this.historyLayers = [];

        while (this.moveLineGroup.children.length) this.moveLineGroup.remove(this.moveLineGroup.children[0]);
        while (this.interLayerGroup.children.length) this.interLayerGroup.remove(this.interLayerGroup.children[0]);

        this.clearHighlights();
        for (i = 0; i < this.lastMoveHL.length; i++) this.currentBoardGroup.remove(this.lastMoveHL[i]);
        this.lastMoveHL = [];

        this.controls.target.set(0, 0, 0);
    }
};
