#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.argv[2] || 8080;
const STAGE8_DIR = '/home/pardus/PROJELER/MELP/LLVM/STAGE8';
const WASM_DIR = '/home/pardus/PROJELER/MELP/ORTAK/WASM';
const BUILD_WASM = path.join(WASM_DIR, 'build_wasm.sh');
const RUN_WASM = path.join(WASM_DIR, 'run_wasm.js');
const MELP_COMPILER = path.join(STAGE8_DIR, 'bin', 'melp_compiler');
const EXAMPLES_DIR = path.join(__dirname, 'playground_examples');

function serveFile(res, filePath, contentType) {
    try { const data = fs.readFileSync(filePath); res.writeHead(200, {'Content-Type':contentType}); res.end(data); }
    catch(e) { res.writeHead(404); res.end('Not found'); }
}

function compileAndRun(melpCode, callback) {
    const tmpDir = '/tmp/melp_playground';
    const mlpFile = tmpDir + '/user.mlp';
    const wasmFile = tmpDir + '/user.wasm';
    try {
        fs.mkdirSync(tmpDir, {recursive:true});
        fs.writeFileSync(mlpFile, melpCode);
        const compileCmd = `cd ${STAGE8_DIR} && export MELP_PATH=${STAGE8_DIR} && cp ${mlpFile} /tmp/.melp_compile_src && timeout 10 ${MELP_COMPILER} > ${tmpDir}/user.ll 2>&1`;
        try { execSync(compileCmd, {timeout:15000}); }
        catch(e) {
            const llOutput = fs.readFileSync(tmpDir+'/user.ll','utf-8').trim();
            const formatted = formatMelpError(llOutput);
            callback(null, {error: formatted, raw: llOutput});
            return;
        }
        try { execSync(`bash ${BUILD_WASM} ${mlpFile} ${wasmFile} 2>&1`, {timeout:30000}); }
        catch(e) { callback(null, {error: 'WASM build failed'}); return; }
        try {
            const output = execSync(`cd ${WASM_DIR} && node ${RUN_WASM} ${wasmFile} 2>&1`, {timeout:10000});
            callback(null, {output: output.toString()});
        } catch(e) {
            callback(null, {output: e.stdout?e.stdout.toString():'', error: e.stderr?e.stderr.toString():'Runtime error'});
        }
        try { fs.rmSync(tmpDir, {recursive:true}); } catch(e) {}
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
