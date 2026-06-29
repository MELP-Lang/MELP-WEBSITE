// MELP Compiler Worker
// Ana thread'den gelen mesajları karşılar, WASM derleme/çalıştırmayı burada yapar.
// UI thread'i bloke olmaz.
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

let _melpModule = null;
let _cancelled  = false;

async function loadMelpModule() {
  if (_melpModule) return _melpModule;
  if (typeof MelpCompiler === 'undefined') {
    throw new Error('MelpCompiler tanımlı değil.');
  }
  // locateFile: .wasm dosyasının gerçek path'ini ver
  // Worker URL'i http://localhost:8080/compiler-worker.js
  // .wasm dosyası http://localhost:8080/wasm/melp_compiler.wasm
  const base = self.location.href.replace(/\/[^/]*$/, '/');
  _melpModule = await MelpCompiler({
    locateFile(filename) {
      return base + 'wasm/' + filename;
    }
  });
  return _melpModule;
}

async function execWasm(wasmBytes) {
  function makeWasiImports() {
    return {
      fd_write(fd, iovPtr, iovCnt, nwrittenPtr) {
        try {
          const mem = new DataView(instance.exports.memory.buffer);
          let written = 0;
          for (let i = 0; i < iovCnt; i++) {
            const base  = mem.getUint32(iovPtr + i * 8,     true);
            const len   = mem.getUint32(iovPtr + i * 8 + 4, true);
            const bytes = new Uint8Array(instance.exports.memory.buffer, base, len);
            const chunk = new TextDecoder().decode(bytes);
            if (fd === 1) self.postMessage({ type: 'run-stdout', stdout: chunk });
            else if (fd === 2) self.postMessage({ type: 'run-stderr', stderr: chunk });
            written += len;
          }
          mem.setUint32(nwrittenPtr, written, true);
        } catch(e) { /* ignore */ }
        return 0;
      },
      fd_fdstat_get: function(fd, buf) {
        try {
          const dv = new DataView(instance.exports.memory.buffer);
          dv.setUint8(buf, 2);       // CHARACTER_DEVICE
          dv.setUint16(buf + 2, 0, true);
          dv.setBigUint64(buf + 8, 0n, true);
          dv.setBigUint64(buf + 16, 0n, true);
        } catch(e) {}
        return 0;
      },
      proc_exit(code)        { throw { exitCode: code }; },
      environ_get()          { return 0; },
      environ_sizes_get()    { return 0; },
      args_get()             { return 0; },
      args_sizes_get()       { return 0; },
      clock_time_get()       { return 0; },
      clock_res_get()        { return 0; },
      fd_close()             { return 0; },
      fd_seek()              { return 0; },
      fd_read()              { return 0; },
      fd_prestat_get()       { return 8; },
      fd_prestat_dir_name()  { return 8; },
      fd_fdstat_set_flags()  { return 0; },
      fd_fdstat_set_rights() { return 0; },
      fd_filestat_get()      { return 0; },
      fd_filestat_set_size() { return 0; },
      fd_filestat_set_times(){ return 0; },
      fd_pread()             { return 0; },
      fd_pwrite()            { return 0; },
      fd_readdir()           { return 0; },
      fd_renumber()          { return 0; },
      path_open()            { return 52; },
      path_unlink_file()     { return 52; },
    };
  }
  const wasiImport = makeWasiImports();
  const importObject = {
    wasi_snapshot_preview1: wasiImport,
    wasi_unstable: wasiImport,
    env: {
      memory: null,  // filled in after instantiation
      emscripten_memcpy_js: function(d,s,n) { instance.exports.memory.copy(d,s,n); },
    }
  };
  let instance;
  ({ instance } = await WebAssembly.instantiate(wasmBytes, importObject));
  // Set memory reference for env.memory import
  if (importObject.env && instance.exports.memory) {
    importObject.env.memory = instance.exports.memory;
  }
  try {
    if (instance.exports._start) {
      instance.exports._start();
    } else {
      instance.exports.main?.();
    }
  } catch (e) {
    if (e && typeof e.exitCode !== 'undefined' && e.exitCode !== 0) {
      return { stderr: `exit code ${e.exitCode}`, exitCode: e.exitCode };
    }
    return { stderr: e.message || 'Runtime error', exitCode: 1 };
  }
  return { stderr: '', exitCode: 0 };
}

async function handleCompile(code, run) {
  _cancelled = false;

  self.postMessage({ type: 'compile-start' });

  let mod;
  try {
    mod = await loadMelpModule();
  } catch (err) {
    self.postMessage({ type: 'compile-error', stderr: err.message });
    return;
  }

  if (_cancelled) { self.postMessage({ type: 'run-cancel' }); return; }

  const rc = mod.ccall('melp_compile', 'number', ['string'], [code]);
  if (rc !== 0) {
    const errStr = mod.ccall('melp_get_error', 'string', [], []);
    self.postMessage({ type: 'compile-error', stderr: errStr || 'Derleme hatası' });
    return;
  }

  const size     = mod.ccall('melp_get_wasm_size', 'number', [], []);
  const ptr      = mod.ccall('melp_get_wasm_ptr',  'number', [], []);
  const wasmBytes = new Uint8Array(mod.HEAPU8.buffer, ptr, size).slice();

  self.postMessage({ type: 'compile-success', size });

  if (!run) return;

  if (_cancelled) { self.postMessage({ type: 'run-cancel' }); return; }

  self.postMessage({ type: 'run-start' });

  // Use proven MelpWasm runtime instead of custom execWasm
  try {
    MelpWasm.clearOutput();
    await MelpWasm.load(wasmBytes.buffer);
    MelpWasm.run();
    const output = MelpWasm.getOutput();
    const exitCode = MelpWasm.getExitCode();
    if (output) self.postMessage({ type: 'run-stdout', stdout: output });
    self.postMessage({ type: 'run-exit', exitCode });
  } catch (err) {
    self.postMessage({ type: 'run-stderr', stderr: err.message });
    self.postMessage({ type: 'run-exit', exitCode: 1 });
  }
}

// melp_compiler.js'i Worker scope'una yükle
try {
  importScripts('./wasm/melp_compiler.js');
  importScripts('./melp_wasm.js');  // MelpWasm: proven WASI runtime with output capture
} catch (e) {
  // path hatası olursa loadMelpModule() içinde yakalanır
}

// Modülü önceden yükle, hazır olunca bildir
Promise.all([
  loadMelpModule(),
  new Promise(r => { if (typeof MelpWasm !== 'undefined') r(); else setTimeout(r, 100); })
])
  .then(() => self.postMessage({ type: 'worker-ready' }))
  .catch(() => self.postMessage({ type: 'worker-ready' })); // hata olsa da UI'yi bloke etme

self.onmessage = function(e) {
  const { type, code, run } = e.data;

  if (type === 'compile') {
    handleCompile(code, run);
    return;
  }

  if (type === 'cancel') {
    _cancelled = true;
    self.postMessage({ type: 'run-cancel' });
    return;
  }
};
