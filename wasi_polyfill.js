// wasi_polyfill.js — Minimal WASI polyfill (Node.js + Browser)
// KRITIK: WASM modulunun KENDI memory'sini kullanir (instance.exports.memory)
// env.memory GECMEYIN — ayri memory yaratmak buyu bozar
'use strict';

const WasiPolyfill = (function() {
    let _output = '';
    let _instance = null;

    function setup() {
        _output = '';
        return {
            wasiImport: buildWasiImport(),
            getOutput: function() { return _output; },
            setInstance: function(inst) { _instance = inst; }
        };
    }

    function mem() { return _instance.exports.memory.buffer; }
    function dv() { return new DataView(mem()); }

    function buildWasiImport() {
        return {
            wasi_snapshot_preview1: {
                fd_write: function(fd, iovs, iovsLen, nwritten) {
                    const view = dv();
                    let written = 0;
                    for (let i = 0; i < iovsLen; i++) {
                        const ptr = view.getUint32(iovs + i * 8, true);
                        const len = view.getUint32(iovs + i * 8 + 4, true);
                        if (fd === 1) {
                            const bytes = new Uint8Array(mem(), ptr, len);
                            _output += new TextDecoder().decode(bytes);
                        }
                        written += len;
                    }
                    view.setUint32(nwritten, written, true);
                    return 0;
                },
                proc_exit: function(code) { throw { exitCode: code }; },
                environ_sizes_get: function(ep, bsp) { const d = dv(); d.setUint32(ep,0,true); d.setUint32(bsp,0,true); return 0; },
                environ_get: function() { return 0; },
                args_sizes_get: function(ap, bsp) { const d = dv(); d.setUint32(ap,0,true); d.setUint32(bsp,0,true); return 0; },
                args_get: function() { return 0; },
                fd_close: function() { return 0; },
                fd_seek: function(fd, off, whence, np) { dv().setBigUint64(np, 0n, true); return 0; },
                fd_read: function(fd, iovs, iovsLen, nread) { dv().setUint32(nread, 0, true); return 0; },
                fd_prestat_get: function() { return 8; },
                fd_prestat_dir_name: function() { return 8; },
                fd_fdstat_get: function(fd, buf) { const d = dv(); d.setUint8(buf,2); d.setUint16(buf+2,0,true); d.setBigUint64(buf+8,0n,true); d.setBigUint64(buf+16,0n,true); return 0; },
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
                fd_tell: function(fd, op) { dv().setBigUint64(op, 0n, true); return 0; },
                path_open: function() { return 44; },
                path_filestat_get: function() { return 0; },
                path_filestat_set_times: function() { return 0; },
                path_create_directory: function() { return 0; },
                path_link: function() { return 0; },
                path_readlink: function() { return 0; },
                path_remove_directory: function() { return 0; },
                path_rename: function() { return 0; },
                path_symlink: function() { return 0; },
                path_unlink_file: function() { return 0; },
                clock_time_get: function(id, prec, tp) { dv().setBigUint64(tp, BigInt(Date.now())*1000000n, true); return 0; },
                clock_res_get: function(id, rp) { dv().setBigUint64(rp, 1000000n, true); return 0; },
                random_get: function() { return 0; },
                sched_yield: function() { return 0; },
                poll_oneoff: function() { return 0; },
                sock_accept: function() { return 0; },
                sock_recv: function() { return 0; },
                sock_send: function() { return 0; },
                sock_shutdown: function() { return 0; },
            }
        };
    }

    return { setup: setup };
})();

if (typeof module !== 'undefined') module.exports = WasiPolyfill;
