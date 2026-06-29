#!/usr/bin/env node
/**
 * run_wasm.js — Minimal WASM runner (test mesaji YOK)
 * Kullanim: node run_wasm.js program.wasm
 */

const MelpWasm = require('/home/pardus/PROJELER/MELP/ORTAK/WASM/melp_wasm.js');

async function main() {
    const wasmPath = process.argv[2];
    if (!wasmPath) { console.error('Usage: node run_wasm.js <program.wasm>'); process.exit(1); }
    
    try {
        const instance = await MelpWasm.load(wasmPath);
        MelpWasm.bindMelpExports();
        MelpWasm.run();
        const output = MelpWasm.getOutput();
        const exitCode = MelpWasm.getExitCode();
        
        if (output) process.stdout.write(output);
        process.exit(exitCode);
    } catch (e) {
        console.error('HATA:', e.message);
        process.exit(1);
    }
}
main();
