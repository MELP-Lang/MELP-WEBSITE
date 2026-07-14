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

## 🔄 STAGE GEÇİŞ CHECKLIST (STAGE N → N+1)

Her STAGE yükseltmesinde şu adımları SIRAYLA uygula:

- [ ] `.stage{N+1}-dep` dosyasını güncelle (SHA + boyut)
- [ ] Local symlink'leri yeni STAGE'a yönlendir:
  ```bash
  cd /home/pardus/PROJELER/MELP/WEB
  rm -f main.mlp modules compiler
  ln -s /home/pardus/PROJELER/MELP/LLVM/STAGE{N+1}/main.mlp main.mlp
  ln -s /home/pardus/PROJELER/MELP/LLVM/STAGE{N+1}/modules modules
  ln -s /home/pardus/PROJELER/MELP/LLVM/STAGE{N+1}/compiler compiler
  ```
- [ ] `.gitignore`'da symlink'lerin olduğunu doğrula (`main.mlp`, `modules`, `compiler`)
- [ ] Cloudflare Pages deploy'unu kontrol et (commit sonrası `https://melp.dev`)

---

## 🚀 PUBLISH KURALLARI (Cloudflare Pages)

> ⚠️ **BU KURALLAR TÜM PD/YZ'LER İÇİN BAĞLAYICIDIR.**
> İhlal eden commit geri alınır.

### 1. Symlink'ler GIT'E ASLA ALINMAZ

`main.mlp`, `modules`, `compiler` symlink'tir — sadece local geliştirme içindir.
Bu dosyalar `.gitignore`'dadır. **Commit edilmeleri Cloudflare Pages deploy'unu kırar.**

```bash
# ❌ YASAK:
git add main.mlp modules compiler

# ✅ Commit öncesi kontrol:
git status --short | grep -E "main.mlp|modules|compiler" && echo "UYARI: Symlink staged!" || echo "Temiz"
```

### 2. Deploy Başarısız Olursa

Cloudflare Pages build hatası alınırsa sırayla kontrol et:

1. Symlink staged mi? → `git status`
2. `.gitignore` güncel mi? → symlink'ler listede olmalı
3. Son başarılı deploy: Cloudflare Dashboard → Deployments

### 3. Deploy Tetikleme

Her `git push origin main` Cloudflare Pages deploy'unu OTOMATİK tetikler.
Manuel müdahale gerekmez. ~60 saniye içinde `https://melp.dev` güncellenir.

### 4. mmproje.md GÜNCEL TUTULMALI

Her görev sonunda `MM_PROJE_SON_DURUM.md`'yi güncelle. Hangi STAGE'da olduğunu,
son deploy tarihini, aktif sorunları yaz.

---

## ⚠️ KESİN YASAKLAR

1. **Binary'yi elle kopyalama.** Sadece `check-ekosistem-sync.sh --fix` kullan.
2. **`.stage10-dep`'i elle düzenleme.** Sadece script günceller.
3. **Symlink'leri commit etme.** Cloudflare Pages deploy'unu kırar (bkz. Publish Kuralları).
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
