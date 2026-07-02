#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.argv[2] || 8080;
const STAGE9_DIR = '/home/pardus/PROJELER/MELP/LLVM/STAGE9';
const WASM_DIR = '/home/pardus/PROJELER/MELP/ORTAK/WASM';
const MELP_COMPILER = path.join(STAGE9_DIR, 'bin', 'melp_compiler');
const SHIM_C = path.join(WASM_DIR, 'shim_compiler_wasm.c');
const EXAMPLES_DIR = path.join(__dirname, 'playground_examples');

function serveFile(res, filePath, contentType) {
    try { const data = fs.readFileSync(filePath); res.writeHead(200, {'Content-Type':contentType}); res.end(data); }
    catch(e) { res.writeHead(404); res.end('Not found'); }
}

function compileAndRun(melpCode, callback) {
    const tmpDir = '/tmp/melp_playground';
    const mlpFile = tmpDir + '/user.mlp';
    const llFile = tmpDir + '/user.ll';
    const wasmFile = tmpDir + '/user.wasm';
    try {
        fs.mkdirSync(tmpDir, {recursive:true});
        fs.writeFileSync(mlpFile, melpCode);
        
        // Step 1: MELP → LLVM IR (STAGE9)
        try {
            fs.writeFileSync('/tmp/.melp_compile_src', melpCode);
            execSync(`cd ${STAGE9_DIR} && export MELP_PATH=${STAGE9_DIR} && timeout 15 ${MELP_COMPILER} > ${llFile} 2>&1`, {timeout:20000});
        } catch(e) {
            const llOutput = fs.readFileSync(llFile,'utf-8').trim();
            callback(null, {error: formatMelpError(llOutput)});
            return;
        }
        
        // Check for MELP errors in IR output
        const irContent = fs.readFileSync(llFile,'utf-8').trim();
        if (irContent.startsWith('HATA') || irContent.includes('HATA [')) {
            callback(null, {error: formatMelpError(irContent)});
            return;
        }
        
        // Step 2: LLVM IR + Shim → WASM (wasm32-wasip1)
        try {
            execSync(`clang-22 --target=wasm32-wasip1 -O2 -c ${SHIM_C} -o ${tmpDir}/shim.o 2>&1`, {timeout:15000});
            execSync(`clang-22 --target=wasm32-wasip1 -O2 -Wl,--no-entry -Wl,--export-all -Wl,--allow-undefined ${tmpDir}/shim.o ${llFile} -o ${wasmFile} 2>&1`, {timeout:15000});
        } catch(e) {
            callback(null, {error: 'WASM build failed: ' + e.message});
            return;
        }
        
        // Step 3: WASM → Node.js (melp_wasm.js)
        try {
            const MelpWasm = require(path.join(WASM_DIR, 'melp_wasm.js'));
            (async () => {
                try {
                    await MelpWasm.load(wasmFile);
                    MelpWasm.run();
                    const output = MelpWasm.getOutput();
                    const exitCode = MelpWasm.getExitCode();
                    callback(null, {output: output, exitCode: exitCode});
                } catch(e) {
                    callback(null, {error: 'Runtime error: ' + e.message});
                }
            })();
            return;
        } catch(e) {
            callback(null, {error: 'Node.js runtime error: ' + e.message});
            return;
        }
    } catch(e) { callback(null, {error: e.message}); }
}

function formatMelpError(raw) {
    const lines = raw.split('\n');
    const formatted = [];
    for (const line of lines) {
        if (line.startsWith('HATA')) formatted.push('🔴 ' + line);
        else if (line.startsWith('  →')) formatted.push('   ' + line);
        else if (line.includes('ICE:')) formatted.push('💥 ' + line);
        else formatted.push(line);
    }
    return formatted.join('\n');
}

function getExamples() {
    try {
        const files = fs.readdirSync(EXAMPLES_DIR).filter(f=>f.endsWith('.mlp')).sort();
        const examples = [];
        for (const f of files) {
            const code = fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8');
            const title = code.split('\n')[0].replace('--','').trim();
            examples.push({id:f.replace('.mlp',''), title, code});
        }
        return examples;
    } catch(e) { return []; }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
    
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html'))
        { serveFile(res, path.join(__dirname,'playground.html'), 'text/html; charset=utf-8'); return; }
    if (req.method === 'GET' && req.url === '/melp_wasm.js')
        { serveFile(res, path.join(WASM_DIR,'melp_wasm.js'), 'application/javascript'); return; }
    if (req.method === 'GET' && req.url === '/api/examples') {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(getExamples()));
        return;
    }
    if (req.method === 'POST' && req.url === '/api/compile') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { code } = JSON.parse(body);
                if (!code) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'No code'})); return; }
                compileAndRun(code, (err, result) => {
                    res.writeHead(200, {'Content-Type':'application/json'});
                    res.end(JSON.stringify(result));
                });
            } catch(e) { res.writeHead(400,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Invalid JSON'})); }
        });
        return;
    }
    res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`MELP Playground: http://localhost:${PORT}`));
