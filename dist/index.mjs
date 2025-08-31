/*!
 * leaflet.heatmap v1.0.0
 * (c) 2025 Alekseev Nikolay
 * MIT License – see LICENSE file
 */
const p = L.GridLayer.extend({
  options: {
    tileSize: 256,
    colorTable: [
      "#d6f5c2",
      "#c6e9a3",
      "#b6dc85",
      "#a9ce6b",
      "#9cc153",
      "#e7d77a",
      "#f3c164",
      "#f9a955",
      "#fb8d4d",
      "#f77049",
      "#f05445",
      "#e03e41",
      "#c6323f",
      "#aa293c",
      "#8e2138"
    ],
    opacity: 0.9
  },
  initialize(t = [], e) {
    if (L.setOptions(this, e), this.points = t, this.idwMinMax = this.computeMinMax(t), this.multiPolygon = this.options.polygon, this._glCanvas = document.createElement("canvas"), Object.assign(this._glCanvas, { width: this.options.tileSize, height: this.options.tileSize }), this._gl = this._glCanvas.getContext("webgl"), !this._gl) throw new Error("WebGL not supported");
    this.initWebGL(this._gl), L.GridLayer.prototype.initialize.call(this, e);
  },
  setPoints(t = []) {
    this.points = t, this.idwMinMax = this.computeMinMax(t), this.redraw();
  },
  computeMinMax(t) {
    const e = t.map((o) => o[2]);
    return [Math.min(...e), Math.max(...e)];
  },
  createTile(t, e) {
    const o = document.createElement("canvas");
    o.width = o.height = this.options.tileSize;
    const c = o.getContext("2d");
    this._gl.viewport(0, 0, this.options.tileSize, this.options.tileSize), this._gl.clear(this._gl.COLOR_BUFFER_BIT), this.drawTile(this._gl, t, this.options.tileSize, this.options.tileSize);
    const i = new Uint8Array(this.options.tileSize ** 2 * 4);
    this._gl.readPixels(
      0,
      0,
      this.options.tileSize,
      this.options.tileSize,
      this._gl.RGBA,
      this._gl.UNSIGNED_BYTE,
      i
    );
    const h = c.createImageData(this.options.tileSize, this.options.tileSize), _ = this.createMask(t);
    for (let r = 0; r < this.options.tileSize; r++)
      for (let a = 0; a < this.options.tileSize; a++) {
        const s = ((this.options.tileSize - r - 1) * this.options.tileSize + a) * 4, u = (r * this.options.tileSize + a) * 4, T = _[u + 3] / 255;
        for (let n = 0; n < 3; n++) h.data[u + n] = i[s + n];
        h.data[u + 3] = i[s + 3] * T;
      }
    return c.putImageData(h, 0, 0), setTimeout(() => e(null, o), 0), o;
  },
  createMask(t) {
    if (!this.multiPolygon) return new Uint8ClampedArray(this.options.tileSize ** 2 * 4);
    const e = document.createElement("canvas");
    e.width = e.height = this.options.tileSize;
    const o = e.getContext("2d");
    return o.clearRect(0, 0, e.width, e.height), this.multiPolygon.forEach((c) => {
      o.beginPath(), c.forEach((i, h) => {
        const _ = this._map.project(L.latLng(i[0], i[1]), t.z), r = _.x - t.x * this.options.tileSize, a = _.y - t.y * this.options.tileSize;
        h === 0 ? o.moveTo(r, a) : o.lineTo(r, a);
      }), o.closePath(), o.fillStyle = "white", o.fill();
    }), o.getImageData(0, 0, this.options.tileSize, this.options.tileSize).data;
  },
  initWebGL(t) {
    var s;
    const e = "attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0,1);}", o = `
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
                gl_FragColor=vec4(color.rgb,${(((s = this.options) == null ? void 0 : s.opacity) || 0.9).toFixed(1)});
            }
        `, c = (u, T) => {
      const n = t.createShader(u);
      if (t.shaderSource(n, T), t.compileShader(n), !t.getShaderParameter(n, t.COMPILE_STATUS)) throw new Error(t.getShaderInfoLog(n));
      return n;
    }, i = t.createProgram();
    t.attachShader(i, c(t.VERTEX_SHADER, e)), t.attachShader(i, c(t.FRAGMENT_SHADER, o)), t.linkProgram(i), t.useProgram(i);
    const h = t.createBuffer();
    t.bindBuffer(t.ARRAY_BUFFER, h), t.bufferData(t.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), t.STATIC_DRAW);
    const _ = t.getAttribLocation(i, "a_position");
    t.enableVertexAttribArray(_), t.vertexAttribPointer(_, 2, t.FLOAT, !1, 0, 0);
    const r = new Uint8Array(this.options.colorTable.length * 3);
    this.options.colorTable.forEach((u, T) => {
      const n = parseInt(u.slice(1), 16);
      r.set([n >> 16 & 255, n >> 8 & 255, n & 255], T * 3);
    });
    const a = t.createTexture();
    if (t.bindTexture(t.TEXTURE_2D, a), t.texImage2D(t.TEXTURE_2D, 0, t.RGB, this.options.colorTable.length, 1, 0, t.RGB, t.UNSIGNED_BYTE, r), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST), ["S", "T"].forEach((u) => t.texParameteri(t.TEXTURE_2D, t["TEXTURE_WRAP_" + u], t.CLAMP_TO_EDGE)), this._colorTexture = a, !t.getExtension("OES_texture_float")) throw new Error("OES_texture_float not supported");
    this._pointTexture = t.createTexture(), this._uniforms = {
      resolution: t.getUniformLocation(i, "u_resolution"),
      tileOrigin: t.getUniformLocation(i, "u_tileOrigin"),
      idwMin: t.getUniformLocation(i, "u_idwMin"),
      idwMax: t.getUniformLocation(i, "u_idwMax"),
      numPoints: t.getUniformLocation(i, "u_numPoints"),
      colorTable: t.getUniformLocation(i, "u_colorTable"),
      pointTexture: t.getUniformLocation(i, "u_pointTexture"),
      textureWidth: t.getUniformLocation(i, "u_textureWidth")
    }, this._program = i;
  },
  drawTile(t, e, o, c) {
    const { tileSize: i } = this.options, h = this.points, _ = h.length, r = 2 ** Math.ceil(Math.log2(_)), a = new Float32Array(r * 4);
    h.forEach((s, u) => {
      const T = this._map.project(L.latLng(s[0], s[1]), e.z);
      a.set([T.x, T.y, s[2], 0], u * 4);
    }), t.activeTexture(t.TEXTURE1), t.bindTexture(t.TEXTURE_2D, this._pointTexture), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, r, 1, 0, t.RGBA, t.FLOAT, a), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.NEAREST), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.NEAREST), ["S", "T"].forEach((s) => t.texParameteri(t.TEXTURE_2D, t["TEXTURE_WRAP_" + s], t.CLAMP_TO_EDGE)), t.viewport(0, 0, o, c), t.clearColor(0, 0, 0, 0), t.clear(t.COLOR_BUFFER_BIT), t.useProgram(this._program), t.uniform2f(this._uniforms.resolution, o, c), t.uniform2f(this._uniforms.tileOrigin, e.x * i, e.y * i), t.uniform1f(this._uniforms.idwMin, this.idwMinMax[0]), t.uniform1f(this._uniforms.idwMax, this.idwMinMax[1]), t.uniform1i(this._uniforms.numPoints, _), t.uniform1i(this._uniforms.textureWidth, r), t.activeTexture(t.TEXTURE0), t.bindTexture(t.TEXTURE_2D, this._colorTexture), t.uniform1i(this._uniforms.colorTable, 0), t.activeTexture(t.TEXTURE1), t.bindTexture(t.TEXTURE_2D, this._pointTexture), t.uniform1i(this._uniforms.pointTexture, 1), t.drawArrays(t.TRIANGLE_STRIP, 0, 4);
  }
}), m = (t, e) => new p(t, e);
export {
  m as default
};
