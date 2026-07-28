// shim_wasm_bridge.c — Virtual socket shim (no stdlib, pure wasm32)
#include <stdint.h>
#include <stddef.h>

typedef __SIZE_TYPE__ size_t;

// JS import
extern void pg_emit(const char* msg, int len);

// ——— Minimal string functions ———
static int slen(const char* s) {
    int n = 0; while (s[n]) n++; return n;
}
static void scpy(char* d, const char* s) {
    while (*s) *d++ = *s++; *d = 0;
}
static int scmp(const char* a, const char* b) {
    while (*a && *a == *b) { a++; b++; }
    return *a - *b;
}
static void* smemset(void* p, int c, size_t n) {
    unsigned char* q = p; while (n--) *q++ = (unsigned char)c; return p;
}

static void emit(const char* s) { pg_emit(s, slen(s)); }
static void emitln(const char* s) { pg_emit(s, slen(s)); pg_emit("\n", 1); }

// ——— Virtual Sockets ———
#define VS_MAX 4
#define VS_BUF 256

typedef struct { int active; int port; int connected; char buf[VS_BUF]; } vsock;
static vsock vs[VS_MAX];

int64_t melp_socket_create(void) {
    for (int i = 0; i < VS_MAX; i++)
        if (!vs[i].active) { vs[i].active = 1; vs[i].port = 0; vs[i].connected = 0; smemset(vs[i].buf, 0, VS_BUF); return i + 3; }
    return -1;
}

int64_t melp_socket_connect(int64_t fd, const char* addr, int64_t port) {
    // Find unused socket
    for (int i = 0; i < VS_MAX; i++) {
        if (vs[i].active && !vs[i].connected) {
            vs[i].port = (int)port; vs[i].connected = 1;
            if (port == 9001) { scpy(vs[i].buf, "CAN:hello_bridge"); }
            return 0;
        }
    }
    return -1;
}

int64_t melp_socket_send(int64_t fd, const char* data) {
    int sp = 0; for (int i = 0; i < VS_MAX; i++) if (vs[i].active && vs[i].connected) { sp = vs[i].port; break; }
    int tp = (sp == 9001) ? 9002 : 9001;
    for (int i = 0; i < VS_MAX; i++) if (vs[i].active && vs[i].connected && vs[i].port == tp) {
        scpy(vs[i].buf, data); return slen(data);
    }
    return -1;
}

int64_t melp_socket_recv(int64_t fd, int64_t max) {
    for (int i = 0; i < VS_MAX; i++) if (vs[i].active && vs[i].connected)
        return (int64_t)(uintptr_t)vs[i].buf;
    return 0;
}

// ——— String helpers for MELP ———
int64_t strlen_melp(const char* s) { return slen(s); }
int64_t str_eq_impl(const char* a, const char* b) { return scmp(a, b) == 0; }
int64_t chr_impl(int64_t n) { static char b[2]; b[0] = (char)n; b[1] = 0; return (int64_t)(uintptr_t)b; }
int64_t str_impl(int64_t n) {
    static char b[32]; int i = 30; b[31] = 0;
    int neg = 0; if (n < 0) { neg = 1; n = -n; }
    do { b[i--] = '0' + (n % 10); n /= 10; } while (n > 0);
    if (neg) b[i--] = '-';
    return (int64_t)(uintptr_t)(b + i + 1);
}

// ——— WASM exports ———
int64_t pg_start(void) { extern int64_t melp_main(void); return melp_main(); }
int64_t pg_frame(int64_t ts) { return 0; }
int64_t pg_close(void) { return 0; }
int64_t pg_running(void) { return 1; }
int64_t pg_is_suspended(void) { return 0; }
