# WEB — MM Başlangıç Rehberi

> ⚠️ Bu belge, bu birimin MM'si için TEK giriş noktasıdır.
> Göreve başlamadan ÖNCE oku.

---

## 🆔 SEN KİMSİN?

Sen bu birimin **MM (Mastermind)**'isin. Sorumluluğun:

- Bu birimin kodunu geliştirmek
- STAGE10 kanonik binary ile uyumlu kalmak
- WASM dosyalarını güncel tutmak (`playground_runner.wasm`, `wasm/demo_*.wasm`)
- Her görev sonunda senkron kontrolü yapmak

---

## 📋 ZORUNLU OKUMA

Göreve başlamadan önce şu belgeleri oku (sırayla):

1. `/home/pardus/PROJELER/MELP/ZORUNLU_KURALLAR.md` — KURAL 1-20
2. `/home/pardus/PROJELER/MELP/LLVM/VERSIONING.md` — Sürüm protokolü
3. **Bu belge** (`MM_BASLANGIC.md`)

---

## 🔄 SÜRÜM PROTOKOLÜ (HER GÖREVDE ZORUNLU)

### Görev başlangıcı:

```bash
cd /home/pardus/PROJELER/MELP/LLVM
bash check-ekosistem-sync.sh
```

Senkron değilse → önce `--fix` ile düzelt, sonra göreve başla.

### Görev sonu:

```bash
cd /home/pardus/PROJELER/MELP/WEB
melp_compiler surum_kontrol.mlp -o /tmp/surum_kontrol
/tmp/surum_kontrol
```

Ya da tek komutla:

```bash
cd /home/pardus/PROJELER/MELP/LLVM && bash check-ekosistem-sync.sh --fix
```

---

## ⚠️ KESİN YASAKLAR

1. **Binary'yi elle kopyalama.** Sadece `check-ekosistem-sync.sh --fix` kullan.
2. **`.stage10-dep`'i elle düzenleme.** Sadece script günceller.
4. **WASM'i elle kopyalama.** `melp2wasm` zinciriyle üret, sonra kopyala.
3. **Senkron olmayan binary ile çalışma.** Önce senkronla, sonra çalış.

---

## 📂 BU BİRİMİN DOSYALARI

| Dosya | Amaç |
|------|------|
| `surum_kontrol.mlp` | Binary senkronizasyonu |
| `.stage9-dep` | STAGE9 binary kilit dosyası |
| `scripts/sync-binary.sh` | Binary kopyalama script'i |

---

*PDA_18 — 5 Temmuz 2026*
