/*!
 * leaflet.heatmap v1.0.0
 * (c) 2025 Alekseev Nikolay
 * MIT License – see LICENSE file
 */

L.GridLayer.heatmap = L.GridLayer.extend({
    options: {
        tileSize: 256,
        colorTable: [
            '#d6f5c2', '#c6e9a3', '#b6dc85', '#a9ce6b', '#9cc153', '#e7d77a', '#f3c164', '#f9a955',
            '#fb8d4d', '#f77049', '#f05445', '#e03e41', '#c6323f', '#aa293c', '#8e2138',
        ],
        opacity: 0.9,
        smooth: false,
    },

    initialize(points = [], options) {
        L.setOptions(this, options);
        this.points = points;
        this.idwMinMax = this.computeMinMax(points);
        this.multiPolygon = this.options.polygon;
        this.smooth = this.options.smooth;

        this._glCanvas = document.createElement('canvas');
        Object.assign(this._glCanvas, { width: this.options.tileSize, height: this.options.tileSize });
        this._gl = this._glCanvas.getContext('webgl');
        if (!this._gl) throw new Error('WebGL not supported');
        this.initWebGL(this._gl);

        L.GridLayer.prototype.initialize.call(this, options);
    },

    setPoints(points = []) {
        this.points = points;
        this.idwMinMax = this.computeMinMax(points);
        this.redraw();
    },

    computeMinMax(points) {
        const values = points.map((p) => p[2]);
        return [Math.min(...values), Math.max(...values)];
    },

    createTile(coords, done) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = this.options.tileSize;
        const ctx = tile.getContext('2d');

        this._gl.viewport(0, 0, this.options.tileSize, this.options.tileSize);
        this._gl.clear(this._gl.COLOR_BUFFER_BIT);
        this.drawTile(this._gl, coords, this.options.tileSize, this.options.tileSize);

        const pixels = new Uint8Array(this.options.tileSize ** 2 * 4);
        this._gl.readPixels(
            0,
            0,
            this.options.tileSize,
            this.options.tileSize,
            this._gl.RGBA,
            this._gl.UNSIGNED_BYTE,
            pixels,
        );

        const imageData = ctx.createImageData(this.options.tileSize, this.options.tileSize);
        const maskData = this.createMask(coords);

        for (let y = 0; y < this.options.tileSize; y++) {
            for (let x = 0; x < this.options.tileSize; x++) {
                const src = ((this.options.tileSize - y - 1) * this.options.tileSize + x) * 4;
                const dst = (y * this.options.tileSize + x) * 4;
                const alpha = maskData[dst + 3] / 255;
                for (let i = 0; i < 3; i++) imageData.data[dst + i] = pixels[src + i];
                imageData.data[dst + 3] = pixels[src + 3] * alpha;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        setTimeout(() => done(null, tile), 0);
        return tile;
    },

    createMask(coords) {
        if (!this.multiPolygon) return new Uint8ClampedArray(this.options.tileSize ** 2 * 4);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = maskCanvas.height = this.options.tileSize;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

        this.multiPolygon.forEach((polygon) => {
            maskCtx.beginPath();
            polygon.forEach((latlng, i) => {
                const p = this._map.project(L.latLng(latlng[0], latlng[1]), coords.z);
                const x = p.x - coords.x * this.options.tileSize;
                const y = p.y - coords.y * this.options.tileSize;
                i === 0 ? maskCtx.moveTo(x, y) : maskCtx.lineTo(x, y);
            });
            maskCtx.closePath();
            maskCtx.fillStyle = 'white';
            maskCtx.fill();
        });

        return maskCtx.getImageData(0, 0, this.options.tileSize, this.options.tileSize).data;
    },

    initWebGL(gl) {
        const vertexShaderSource = `attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0,1);}`;
        const fragmentShaderSource = `
            precision mediump float;
            uniform vec2 u_resolution,u_tileOrigin;
            uniform sampler2D u_pointTexture,u_colorTable;
            uniform float u_idwMin,u_idwMax;
            uniform int u_numPoints,u_textureWidth;
            float power=4.0;
            vec3 getPoint(int i){
                float u=(float(i)+0.5)/float(u_textureWidth);
                return texture2D(u_pointTexture,vec2(u,0.5)).xyz;
            }
            float idw(vec2 pos){
                float n=0.,d=0.;
                for(int i=0;i<2048;i++){
                    if(i>=u_numPoints) break;
                    vec3 p=getPoint(i);
                    float w=pow(pow(pos.x-p.x,2.)+pow(pos.y-p.y,2.),0.5*power);
                    w = w>0.?1./w:1.;
                    n+=w*p.z; d+=w;
                }
                return (n/d-u_idwMin)/(u_idwMax-u_idwMin);
            }
            void main(){
                if(u_numPoints==0) discard;
                vec2 uv=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y)/u_resolution;
                vec2 pos=u_tileOrigin+uv*u_resolution;
                float val=idw(pos);
                vec4 color=texture2D(u_colorTable,vec2(val,0.5));
                gl_FragColor=vec4(color.rgb,${(this.options?.opacity || 0.9).toFixed(1)});
            }
        `;

        const compileShader = (type, src) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        };

        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
        gl.linkProgram(program);
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const colorData = new Uint8Array(this.options.colorTable.length * 3);
        this.options.colorTable.forEach((hex, i) => {
            const v = parseInt(hex.slice(1), 16);
            colorData.set([(v >> 16) & 255, (v >> 8) & 255, v & 255], i * 3);
        });
        const colorTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTex);
        console.log(this.options);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, this.options.colorTable.length, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, colorData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.smooth ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.smooth ? gl.LINEAR : gl.NEAREST);
        ['S', 'T'].forEach((d) => gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_WRAP_' + d], gl.CLAMP_TO_EDGE));
        this._colorTexture = colorTex;

        if (!gl.getExtension('OES_texture_float')) throw new Error('OES_texture_float not supported');
        this._pointTexture = gl.createTexture();

        this._uniforms = {
            resolution: gl.getUniformLocation(program, 'u_resolution'),
            tileOrigin: gl.getUniformLocation(program, 'u_tileOrigin'),
            idwMin: gl.getUniformLocation(program, 'u_idwMin'),
            idwMax: gl.getUniformLocation(program, 'u_idwMax'),
            numPoints: gl.getUniformLocation(program, 'u_numPoints'),
            colorTable: gl.getUniformLocation(program, 'u_colorTable'),
            pointTexture: gl.getUniformLocation(program, 'u_pointTexture'),
            textureWidth: gl.getUniformLocation(program, 'u_textureWidth'),
        };
        this._program = program;
    },

    drawTile(gl, coords, width, height) {
        const { tileSize } = this.options;
        const points = this.points,
            numPoints = points.length;
        const texWidth = 2 ** Math.ceil(Math.log2(numPoints));
        const data = new Float32Array(texWidth * 4);

        points.forEach((p, i) => {
            const proj = this._map.project(L.latLng(p[0], p[1]), coords.z);
            data.set([proj.x, proj.y, p[2], 0], i * 4);
        });

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._pointTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, 1, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        ['S', 'T'].forEach((d) => gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_WRAP_' + d], gl.CLAMP_TO_EDGE));

        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this._program);

        gl.uniform2f(this._uniforms.resolution, width, height);
        gl.uniform2f(this._uniforms.tileOrigin, coords.x * tileSize, coords.y * tileSize);
        gl.uniform1f(this._uniforms.idwMin, this.idwMinMax[0]);
        gl.uniform1f(this._uniforms.idwMax, this.idwMinMax[1]);
        gl.uniform1i(this._uniforms.numPoints, numPoints);
        gl.uniform1i(this._uniforms.textureWidth, texWidth);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._colorTexture);
        gl.uniform1i(this._uniforms.colorTable, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._pointTexture);
        gl.uniform1i(this._uniforms.pointTexture, 1);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
});

L.heatmap = (points, options) =>  new L.GridLayer.heatmap(points, options);

export default L.heatmap;
