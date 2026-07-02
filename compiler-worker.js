// MELP Compiler Worker v2 — Raw WASM (Emscripten'siz)
// STAGE11 FAZ 2: Emscripten API → Raw WASM Exports
// 
// Mesaj protokolü (ana thread → worker):
//   { type: 'compile', code, run }
//   { type: 'cancel' }
//
// Mesaj protokolü (worker → ana thread):
//   { type: 'worker-ready' }
//   { type: 'compile-start' }
//   { type: 'compile-success', size }
//   { type: 'compile-error', stderr }
//   { type: 'run-start' }
//   { type: 'run-stdout', stdout }
//   { type: 'run-stderr', stderr }
//   { type: 'run-exit', exitCode }
//   { type: 'run-cancel' }

'use strict';

// ── VFS (Virtual File System) ─────────────────────────────────────
const VFS = {
    _files: new Map(),
    _fds: [],
    
    preload(modules) {
        for (const m of modules) { this._files.set(m.path, m.content); }
    },
    
    setSource(code) { this._files.set('/tmp/.melp_compile_src', code); },
    
    open(p) {
        const c = this._files.get(p);
        if (c !== undefined) {
            const fd = this._fds.length;
            this._fds.push({ path: p, pos: 0, content: c });
            return fd;
        }
        // Lazy-load from server (sync XHR — OK in Worker)
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', p, false);  // sync
            xhr.send();
            if (xhr.status === 200) {
                const content = xhr.responseText;
                this._files.set(p, content);
                const fd = this._fds.length;
                this._fds.push({ path: p, pos: 0, content });
                return fd;
            }
        } catch (e) { /* fall through */ }
        return -1;
    },
    
    close(fd) {
        if (fd >= 0 && fd < this._fds.length) { this._fds[fd] = null; return 0; }
        return -1;
    },
    
    read(fd, buf, count) {
        const f = this._fds[fd]; if (!f) return 0;
        const avail = f.content.length - f.pos;
        const n = Math.min(count, avail);
        new Uint8Array(buf).set(new TextEncoder().encode(f.content.slice(f.pos, f.pos + n)));
        f.pos += n; return n;
    },
    
    write(fd, buf, count) {
        const f = this._fds[fd]; if (!f) return 0;
        const chunk = new TextDecoder().decode(new Uint8Array(buf, 0, count));
        f.content = f.content.slice(0, f.pos) + chunk + f.content.slice(f.pos + count);
        f.pos += count; return count;
    },
    
    seek(fd, offset, whence) {
        const f = this._fds[fd]; if (!f) return -1;
        if (whence === 0) f.pos = offset;
        else if (whence === 1) f.pos += offset;
        else f.pos = f.content.length + offset;
        if (f.pos < 0) f.pos = 0;
        if (f.pos > f.content.length) f.pos = f.content.length;
        return f.pos;
    }
};

// ── WASI Runtime ───────────────────────────────────────────────────
class WasiRuntime {
    constructor(vfs) {
        this._vfs = vfs; this._mem = null;
        this._stdout = []; this._stderr = [];
    }
    
    readStr(ptr, len) {
        if (!len) return '';
        return new TextDecoder().decode(new Uint8Array(this._mem.buffer, ptr, len));
    }
    
    writeStr(ptr, str) {
        new Uint8Array(this._mem.buffer, ptr, str.length).set(new TextEncoder().encode(str));
        return str.length;
    }
    
    makeWasiImports() {
        const S = this;
        const V = S._vfs;
        return {
            environ_get: (ep, ebp) => {
                const env = ['MELP_PATH=/']; let off = 0;
                const dv = new DataView(S._mem.buffer);
                for (let i = 0; i < env.length; i++) {
                    const s = env[i] + '\0'; S.writeStr(ebp + off, s);
                    dv.setUint32(ep + i*4, ebp + off, true); off += s.length;
                }
                return 0;
            },
            environ_sizes_get: (cp, bsp) => {
                const env = ['MELP_PATH=/']; let t = 0;
                for (const e of env) t += e.length + 1;
                const dv = new DataView(S._mem.buffer);
                dv.setUint32(cp, env.length, true); dv.setUint32(bsp, t, true);
                return 0;
            },
            args_get: (ap, abp) => { return 0; },
            args_sizes_get: (acp, absp) => {
                const dv = new DataView(S._mem.buffer);
                dv.setUint32(acp, 0, true); dv.setUint32(absp, 0, true);
                return 0;
            },
            fd_write: (fd, iovPtr, iovCnt, nwrittenPtr) => {
                let w = 0; const dv = new DataView(S._mem.buffer);
                for (let i = 0; i < iovCnt; i++) {
                    const base = dv.getUint32(iovPtr + i*8, true);
                    const len = dv.getUint32(iovPtr + i*8 + 4, true);
                    const chunk = new TextDecoder().decode(new Uint8Array(S._mem.buffer, base, len));
                    if (fd === 1) S._stdout.push(chunk);
                    else if (fd === 2) S._stderr.push(chunk);
                    w += len;
                }
                if (nwrittenPtr) dv.setUint32(nwrittenPtr, w, true);
                return 0;
            },
            fd_read: (fd, iovPtr, iovCnt, nreadPtr) => {
                let tr = 0; const dv = new DataView(S._mem.buffer);
                for (let i = 0; i < iovCnt; i++) {
                    const base = dv.getUint32(iovPtr + i*8, true);
                    const len = dv.getUint32(iovPtr + i*8 + 4, true);
                    const tmp = new ArrayBuffer(len);
                    const n = V.read(fd, tmp, len);
                    new Uint8Array(S._mem.buffer, base, n).set(new Uint8Array(tmp, 0, n));
                    tr += n; if (n < len) break;
                }
                if (nreadPtr) dv.setUint32(nreadPtr, tr, true);
                return 0;
            },
            fd_close: (fd) => V.close(fd),
            fd_seek: (fd, off, whence, np) => {
                const pos = V.seek(fd, off, whence);
                if (np) new DataView(S._mem.buffer).setUint64(np, BigInt(pos), true);
                return pos >= 0 ? 0 : -1;
            },
            fd_prestat_get: (fd, bp) => {
                if (fd === 3) {
                    const dv = new DataView(S._mem.buffer);
                    dv.setUint8(bp, 0); dv.setUint32(bp + 4, 1, true);
                    return 0;
                }
                return 8;
            },
            fd_prestat_dir_name: (fd, pp, pl) => {
                if (fd === 3) { S.writeStr(pp, '/'); return 0; }
                return 8;
            },
            fd_fdstat_get: (fd, bp) => {
                const dv = new DataView(S._mem.buffer);
                dv.setUint8(bp, fd === 3 ? 3 : 2);
                dv.setUint16(bp + 2, 0, true);
                dv.setBigUint64(bp + 8, 0n, true);
                dv.setBigUint64(bp + 16, 0n, true);
                return 0;
            },
            fd_fdstat_set_flags: () => 0,
            fd_fdstat_set_rights: () => 0,
            fd_filestat_get: () => 0,
            fd_filestat_set_size: () => 0,
            fd_filestat_set_times: () => 0,
            fd_pread: () => 0,
            fd_pwrite: () => 0,
            fd_readdir: () => 0,
            fd_renumber: () => 0,
            fd_advise: () => 0,
            fd_allocate: () => 0,
            fd_datasync: () => 0,
            fd_sync: () => 0,
            fd_tell: (fd, op) => {
                const f = V._fds[fd]; if (!f) return -1;
                if (op) new DataView(S._mem.buffer).setUint64(op, BigInt(f.pos), true);
                return 0;
            },
            path_open: (rfd, df, pp, pl, of, rb, ri, fs, fdp) => {
                const p = S.readStr(pp, pl);
                const fd = V.open(p);
                if (fdp) new DataView(S._mem.buffer).setUint32(fdp, fd, true);
                return fd >= 0 ? 0 : 44;
            },
            path_filestat_get: () => 0,
            path_filestat_set_times: () => 0,
            path_create_directory: () => 0,
            path_link: () => 0,
            path_readlink: () => 0,
            path_remove_directory: () => 0,
            path_rename: () => 0,
            path_symlink: () => 0,
            path_unlink_file: () => 0,
            clock_time_get: (id, prec, tp) => {
                if (tp) new DataView(S._mem.buffer).setBigUint64(tp, BigInt(Date.now()) * 1000000n, true);
                return 0;
            },
            clock_res_get: (id, rp) => {
                if (rp) new DataView(S._mem.buffer).setBigUint64(rp, 1000000n, true);
                return 0;
            },
            proc_exit: (code) => { throw { exitCode: code }; },
            random_get: () => 0,
            sched_yield: () => 0,
            poll_oneoff: () => 0,
            sock_accept: () => 0, sock_recv: () => 0, sock_send: () => 0, sock_shutdown: () => 0,
        };
    }
    
    makeEnvImports() {
        const S = this;
        return {
            memory: null,
            __wasm_call_ctors: () => {},
            emscripten_memcpy_js: (d, s, n) => { new Uint8Array(S._mem.buffer).copyWithin(d, s, s + n); },
            // STAGE11 FAZ 1: str_contains runtime fonksiyonu
            mlp_str_contains: (haystack_handle, needle_handle) => {
                try {
                    const mem = new Uint8Array(S._mem.buffer);
                    const readStr = (handle) => {
                        // MELP string ABI v1: tagged handles
                        const h = BigInt(handle);
                        let ptr;
                        if ((h & 0x8000000000000000n) !== 0n) {
                            // HEAP: bit 63 set → clear it
                            ptr = Number(h & 0x7FFFFFFFFFFFFFFFn);
                        } else if ((h & 0x4000000000000000n) !== 0n) {
                            // INLINE: bit 62 set, ≤7B packed little-endian
                            let val = h & 0x00FFFFFFFFFFFFFFn;
                            const chars = [];
                            for (let i = 0; i < 7; i++) {
                                const c = Number(val & 0xFFn);
                                if (c === 0) break;
                                chars.push(String.fromCharCode(c));
                                val >>= 8n;
                            }
                            return chars.join('');
                        } else {
                            // RAW pointer (legacy)
                            ptr = Number(h);
                        }
                        let end = ptr;
                        while (end < mem.length && mem[end] !== 0) end++;
                        return new TextDecoder().decode(mem.slice(ptr, end));
                    };
                    const h = readStr(haystack_handle);
                    const n = readStr(needle_handle);
                    return h.includes(n) ? 1n : 0n;
                } catch(e) { return 0n; }
            },
            // LLVM compiler-rt: 128-bit multiply overflow (WASI libc gereksinimi)
            // Signature: (i64 a_lo, i64 a_hi, i64 b_lo, i64 b_hi, i32 result_ptr) -> ()
            // result_ptr: [i128_result_lo: i64, i128_result_hi: i64, overflow: i32]
            __muloti4: (a_lo, a_hi, b_lo, b_hi, result_ptr) => {
                try {
                    const dv = new DataView(S._mem.buffer);
                    const rp = Number(result_ptr);
                    // Stub: result = 0, overflow = 0
                    dv.setBigUint64(rp, 0n, true);      // result lo
                    dv.setBigUint64(rp + 8, 0n, true);   // result hi
                    dv.setUint32(rp + 16, 0, true);      // overflow
                } catch(e) { /* ignore */ }
            },
        };
    }
    
    reset() { this._stdout = []; this._stderr = []; }
}

// ── Module Loading ─────────────────────────────────────────────────
let _modulesLoaded = false;

async function preloadModules() {
    if (_modulesLoaded) return;
    
    const MODULE_FILES = [
        'modules/core/ast_nodes.mlp', 'modules/core/symtab.mlp', 'modules/core/kapsam.mlp',
        'modules/core/import.mlp', 'modules/core/validate.mlp', 'modules/core/validate_tunnel.mlp',
        'modules/core/enum_codegen.mlp', 'modules/core/MELP.mlp', 'modules/core/ffi_types.mlp',
        'modules/core/ice.mlp', 'modules/core/pipeline_init.mlp', 'modules/core/prelude.mlp',
        'modules/lexer/lexer.mlp',
        'modules/parser/parser.mlp', 'modules/parser/parser_list.mlp',
        'modules/parser/parser_match.mlp', 'modules/parser/parse_next.mlp',
        'modules/parser/parser_import.mlp', 'modules/parser/parser_enum.mlp',
        'modules/expr/parser.mlp', 'modules/stmt/parser.mlp', 'modules/function/parser.mlp',
        'modules/struct/parser.mlp', 'modules/codegen/codegen.mlp',
        'modules/stdlib/stdlib.mlp', 'modules/ok/ok.mlp', 'main.mlp'
    ];
    
    const moduleBase = new URL('modules/', self.location.href).href;
    
    await Promise.allSettled(
        MODULE_FILES.map(async (p) => {
            try {
                const resp = await fetch(moduleBase + p);
                if (resp.ok) VFS._files.set(p, await resp.text());
            } catch (e) { /* skip unavailable */ }
        })
    );
    
    _modulesLoaded = true;
}

// ── Compiler WASM ──────────────────────────────────────────────────
let _instance = null, _wasi = null, _cancelled = false;

async function loadCompilerWasm() {
    if (_instance) return _instance;
    
    const wasmUrl = new URL('wasm/melp_compiler_v2.wasm', self.location.href).href;
    const resp = await fetch(wasmUrl);
    if (!resp.ok) throw new Error('WASM fetch failed: ' + resp.status);
    const wasmBuf = await resp.arrayBuffer();
    
    _wasi = new WasiRuntime(VFS);
    const imp = {
        wasi_snapshot_preview1: _wasi.makeWasiImports(),
        wasi_unstable: _wasi.makeWasiImports(),
        env: _wasi.makeEnvImports(),
    };
    
    const res = await WebAssembly.instantiate(wasmBuf, imp);
    _instance = res.instance;
    _wasi._mem = _instance.exports.memory;
    if (imp.env.memory !== undefined) imp.env.memory = _instance.exports.memory;
    
    return _instance;
}

// ── Handle Compile ─────────────────────────────────────────────────
async function handleCompile(code, run) {
    _cancelled = false;
    self.postMessage({ type: 'compile-start' });
    
    try {
        const inst = await loadCompilerWasm();
        _wasi.reset();
        VFS.setSource(code);
        
        try {
            if (inst.exports._start) inst.exports._start();
            else if (inst.exports.main) inst.exports.main();
            else throw new Error('No _start or main export');
        } catch (e) {
            const capturedStdout = _wasi._stdout.join('');
            const capturedStderr = _wasi._stderr.join('');
            if (e && typeof e.exitCode !== 'undefined') {
                if (e.exitCode !== 0) {
                    const err = capturedStderr || capturedStdout || ('exit code ' + e.exitCode);
                    self.postMessage({ type: 'compile-error', stderr: err });
                    return;
                }
            } else {
                const detail = capturedStderr || capturedStdout || e.message || 'Runtime error';
                self.postMessage({ type: 'compile-error', stderr: detail });
                return;
            }
        }
        
        const stdout = _wasi._stdout.join('');
        const stderr = _wasi._stderr.join('');
        
        if (stderr.includes('HATA') || stdout.includes('HATA [')) {
            self.postMessage({ type: 'compile-error', stderr: stdout || stderr });
            return;
        }
        
        self.postMessage({ type: 'compile-success', size: stdout.length });
        
        if (_cancelled) { self.postMessage({ type: 'run-cancel' }); return; }
        if (!run) return;
        
        self.postMessage({ type: 'run-start' });
        self.postMessage({ type: 'run-stdout', stdout: stdout });
        self.postMessage({ type: 'run-exit', exitCode: 0 });
        
    } catch (err) {
        self.postMessage({ type: 'compile-error', stderr: err.message });
    }
}

// ── Init ───────────────────────────────────────────────────────────
loadCompilerWasm()
    .then(() => self.postMessage({ type: 'worker-ready' }))
    .catch(() => self.postMessage({ type: 'worker-ready' }));

self.onmessage = function(e) {
    const { type, code, run } = e.data;
    if (type === 'compile') handleCompile(code, run);
    if (type === 'cancel') _cancelled = true;
};
