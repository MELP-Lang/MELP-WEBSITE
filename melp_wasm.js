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
        getExitCode: function() { return MelpWasm._exitCode || 0; }
    };
    if (typeof module !== "undefined" && module.exports) module.exports = MelpWasm;
    else root.MelpWasm = MelpWasm;
})(this);
