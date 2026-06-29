/**
 * melp_wasm.js — MELP WASM Executor (Browser + Node.js)
 * WASI polyfill + MELP runtime loader.
 * Supports both browser and Node.js.
 */
(function(root) {
    'use strict';
    const MelpWasm = {
        _output: [],
        _instance: null,
        _memory: null,
        _exitCode: 0,
        _wasiImport: {
            fd_write: function(fd, iovs, iovsLen, nwritten) {
                try {
                    const mem = MelpWasm._memory;
                    if (!mem) return 0;
                    const u8 = new Uint8Array(mem.buffer);
                    let total = 0;
                    for (let i = 0; i < iovsLen; i++) {
                        const dv = new DataView(mem.buffer);
                        const ptr = dv.getUint32(iovs + i * 8, true);
                        const len = dv.getUint32(iovs + i * 8 + 4, true);
                        let str = "";
                        for (let j = 0; j < len; j++) str += String.fromCharCode(u8[ptr + j]);
                        if (fd === 1) MelpWasm._output.push(str);
                        else if (fd === 2) MelpWasm._output.push('[err] ' + str);
                        total += len;
                    }
                    if (nwritten) new DataView(mem.buffer).setUint32(nwritten, total, true);
                } catch(e) {}
                return 0;
            },
            fd_fdstat_get: function(fd, buf) {
                try {
                    const dv = new DataView(MelpWasm._memory.buffer);
                    dv.setUint8(buf, 2);       /* CHARACTER_DEVICE */
                    dv.setUint16(buf + 2, 0, true);
                    dv.setBigUint64(buf + 8, 0n, true);
                    dv.setBigUint64(buf + 16, 0n, true);
                } catch(e) {}
                return 0;
            },
            fd_close: function() { return 0; },
            fd_seek: function() { return 0; },
            fd_read: function(fd, iovs, iovsLen, nread) {
                try { if (nread) new DataView(MelpWasm._memory.buffer).setUint32(nread, 0, true); } catch(e) {}
                return 0;
            },
            fd_prestat_get: function() { return 8; },
            fd_prestat_dir_name: function() { return 8; },
            fd_fdstat_set_flags: function() { return 0; },
            fd_fdstat_set_rights: function() { return 0; },
            fd_filestat_get: function() { return 0; },
            fd_filestat_set_size: function() { return 0; },
            fd_filestat_set_times: function() { return 0; },
            fd_pread: function() { return 0; },
            fd_pwrite: function() { return 0; },
            fd_readdir: function() { return 0; },
            fd_renumber: function() { return 0; },
            fd_advise: function() { return 0; },
            fd_allocate: function() { return 0; },
            fd_datasync: function() { return 0; },
            fd_sync: function() { return 0; },
            fd_tell: function() { return 0; },
            path_create_directory: function() { return 0; },
            path_filestat_get: function() { return 0; },
            path_filestat_set_times: function() { return 0; },
            path_link: function() { return 0; },
            path_open: function() { return 0; },
            path_readlink: function() { return 0; },
            path_remove_directory: function() { return 0; },
            path_rename: function() { return 0; },
            path_symlink: function() { return 0; },
            path_unlink_file: function() { return 0; },
            poll_oneoff: function() { return 0; },
            proc_raise: function() { return 0; },
            random_get: function() { return 0; },
            sched_yield: function() { return 0; },
            sock_accept: function() { return 0; },
            sock_recv: function() { return 0; },
            sock_send: function() { return 0; },
            sock_shutdown: function() { return 0; },
            clock_res_get: function() { return 0; },
            clock_time_get: function() { return 0; },
            args_sizes_get: function(argc, bufSize) {
                try {
                    const dv = new DataView(MelpWasm._memory.buffer);
                    dv.setUint32(argc, 0, true);
                    dv.setUint32(bufSize, 0, true);
                } catch(e) {}
                return 0;
            },
            args_get: function() { return 0; },
            environ_sizes_get: function(environCount, environBufSize) {
                try {
                    const dv = new DataView(MelpWasm._memory.buffer);
                    dv.setUint32(environCount, 0, true);
                    dv.setUint32(environBufSize, 0, true);
                } catch(e) {}
                return 0;
            },
            environ_get: function() { return 0; },
            proc_exit: function(code) {
                MelpWasm._exitCode = code;
            }
        },
        load: async function(module) {
            MelpWasm._output = [];
            MelpWasm._exitCode = 0;
            let mod;
            if (module instanceof WebAssembly.Module) mod = module;
            else if (module instanceof ArrayBuffer || module instanceof Uint8Array) mod = await WebAssembly.compile(module);
            else if (typeof module === "string") {
                if (typeof require !== "undefined") mod = await WebAssembly.compile(require("fs").readFileSync(module));
                else mod = await WebAssembly.compileStreaming(fetch(module));
            } else throw new Error("Invalid module");
            const inst = await WebAssembly.instantiate(mod, { wasi_snapshot_preview1: MelpWasm._wasiImport });
            MelpWasm._instance = inst;
            MelpWasm._memory = inst.exports.memory;
            return inst;
        },
        run: function() {
            const inst = MelpWasm._instance;
            if (!inst) throw new Error("No WASM instance");
            if (typeof inst.exports.melp_main === "function") inst.exports.melp_main();
            else if (typeof inst.exports._start === "function") inst.exports._start();
            else if (typeof inst.exports.main === "function") inst.exports.main();
            else throw new Error("No main export found");
        },
        getOutput: function() { return MelpWasm._output.join(""); },
        clearOutput: function() { MelpWasm._output = []; },
        getExitCode: function() { return MelpWasm._exitCode || 0; },

        // WASM Bridge: linear memory'deki tampona dogrudan erisim
        _bridgeOffset: 0x10000,  // WASM_BRIDGE_BUF ile ayni
        _bridgeSize: 4096,

        // MELP'ten gelen mesaji oku (JS tarafi)
        recvFromMelp: function() {
            try {
                const mem = this._memory;
                if (!mem) return null;
                const buf = new Uint8Array(mem.buffer, this._bridgeOffset, this._bridgeSize);
                const dv = new DataView(mem.buffer, this._bridgeOffset, 8);
                const msgType = dv.getInt32(0, true);
                const msgLen = dv.getInt32(4, true);
                if (msgLen <= 0 || msgLen > this._bridgeSize - 8) return null;
                let str = '';
                for (let i = 0; i < msgLen; i++) str += String.fromCharCode(buf[8 + i]);
                // Temizle
                dv.setInt32(0, 0, true);
                dv.setInt32(4, 0, true);
                return { type: msgType, data: str };
            } catch(e) { return null; }
        },

        // MELP'e mesaj gonder (JS tarafi)
        sendToMelp: function(msg) {
            try {
                const mem = this._memory;
                if (!mem) return false;
                const buf = new Uint8Array(mem.buffer, this._bridgeOffset, this._bridgeSize);
                const dv = new DataView(mem.buffer, this._bridgeOffset, 8);
                const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
                const len = Math.min(data.length, this._bridgeSize - 8);
                dv.setInt32(0, 1, true);  /* text */
                dv.setInt32(4, len, true);
                for (let i = 0; i < len; i++) buf[8 + i] = data.charCodeAt(i);
                return true;
            } catch(e) { return false; }
        },

        // WASM'a ek MELP fonksiyonlarini bagla (load sonrasi cagrilir)
        _exports: null,
        bindMelpExports: function() {
            this._exports = this._instance.exports;
        },

        // DOM komut yorumlayicisi (STAGE9 Faz 2)
        _processDomCommand: function(cmd) {
            const parts = cmd.split('|');
            const op = parts[0];
            const id = parts[1];
            if (op === 'CREATE') {
                const el = document.createElement('div');
                el.id = 'melp-' + id;
                for (let i = 2; i < parts.length; i++) {
                    const eq = parts[i].indexOf('=');
                    if (eq < 0) continue;
                    const k = parts[i].substring(0, eq);
                    const v = parts[i].substring(eq + 1);
                    if (k === 'type') el.setAttribute('data-melp-type', v);
                    else if (k === 'text') el.textContent = v;
                    else if (k === 'x') el.style.left = v + 'px';
                    else if (k === 'y') el.style.top = v + 'px';
                    else if (k === 'w') el.style.width = v + 'px';
                    else if (k === 'h') el.style.height = v + 'px';
                }
                el.style.position = 'absolute';
                el.style.border = '1px solid #333';
                el.style.padding = '4px';
                el.style.cursor = 'pointer';
                el.addEventListener('click', function() {
                    MelpWasm.sendToMelp('EVENT|click|' + id);
                });
                const app = document.getElementById('melp-app');
                if (app) app.appendChild(el);
            } else if (op === 'UPDATE') {
                const el = document.getElementById('melp-' + id);
                if (!el) return;
                for (let i = 2; i < parts.length; i++) {
                    const eq = parts[i].indexOf('=');
                    if (eq < 0) continue;
                    const k = parts[i].substring(0, eq);
                    const v = parts[i].substring(eq + 1);
                    if (k === 'text') el.textContent = v;
                }
            } else if (op === 'DELETE') {
                const el = document.getElementById('melp-' + id);
                if (el) el.remove();
            }
        },

        // MELP'ten gelen DOM komutlarini periyodik isle
        pollMelpMessages: function() {
            const msg = this.recvFromMelp();
            if (msg && msg.data) {
                const commands = msg.data.split('\n');
                for (const cmd of commands) {
                    if (cmd.trim()) this._processDomCommand(cmd.trim());
                }
            }
        }
    };
    if (typeof module !== "undefined" && module.exports) module.exports = MelpWasm;
    else root.MelpWasm = MelpWasm;
})(this);
