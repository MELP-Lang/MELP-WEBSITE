# KANON ↔ SİTE UYUMSUZLUK DENETİM RAPORU

> **WEB MM** | 19 Temmuz 2026 | Talimat: `PROJE_İLETİŞİM/WEB_MM_TALIMAT_KANON_SITE_DENETIMI.md`
> **Saha:** `WEB/` — 11 sayfa · dal `melpdev-durustluk-elden-gecirme`
> **SİLME YAPILMADI.** Bu rapor karar içindir; her 🔴 için soru sonda.

---

## ÖZET

| Kategori | Adet | Ağırlık |
|---|:--:|---|
| 🔴 YOK / REDDEDİLMİŞ | 6 | Değişmez 7 ve Değişmez 2 ihlalleri |
| 🟡 ÇELİŞKİLİ | 2 | Site kendi içinde iki farklı şey diyor |
| 🟢 GERÇEK ama DAMGA/SÜRÜM yanlış | 3 | Var, ama olduğundan büyük gösteriliyor |

**En ciddi bulgu:** `spawn` yalnızca kanona aykırı değil — derleyicide
**sessizce çöküyor**. `exit=0` döndürüyor ama IR'de sıfır fonksiyon
tanımı üretiyor; yani `spawn` içeren her program sessizce boş binary'ye
gidiyor. Bu Değişmez 3 ihlali ("sessiz yanlış olmaz") ve site bunu
"çalışıyor" diye belgeliyor.

---

## DERLEYİCİ TESTLERİ (kanıtın ikinci ayağı)

Yöntem: gate'in KURAL 12 prosedürü — kaynak `/tmp/.melp_compile_src`'e
yazılır, `bin/melp_compiler` çalıştırılır, üretilen IR'deki `^define`
sayısı ölçülür. Kontrol programı 1 define üretir.

| Test | exit | define | Sonuç |
|---|:--:|:--:|---|
| **temel (kontrol)** | 0 | 1 | ✅ üretiyor |
| **spawn** | 0 | **0** | ❌ FONKSİYON ÜRETMİYOR — sessiz çöküş |
| **lambda** | 0 | 1 | ✅ üretiyor |
| **tuple** | **139** | 0 | ❌ SEGFAULT |
| **continue** | 1 | 0 | ❌ derleme hatası (beklenen) |

`spawn` IR çıktısının son satırı: `; streaming OK` — hata mesajı YOK,
hata sayacı artmıyor, yalnızca gövde kayboluyor.

---

## 🔴 KATEGORİ 1 — YOK / REDDEDİLMİŞ

### 🔴-1 `spawn` özellik bölümü — `ozellikler.html` §4 (satır 218-245)

| | |
|---|---|
| **İddia** | "MELP, eşzamanlılık için dil düzeyinde `spawn` ve `channel` desteği sunar" + İngilizce/Türkçe kod örnekleri |
| **Aykırı** | `TASARIM_DEGISMEZLERI.md:143` — Değişmez 7 tablosu: `go` goroutine + channel → ❌ ithal kalıp. Satır 133: "Ayrı bir timing mekanizması (async/await, thread, coroutine, future, callback) YOKTUR" |
| **Derleyici** | `spawn` → **0 define**, sessiz çöküş (yukarıdaki tablo) |
| **Ek çelişki** | Aynı sayfada §9 "mutex/atomic keyword'ü yok, LIFO/FIFO dokudadır" diyor — §4 ile çelişiyor |
| **Öneri** | **Değiştir** — bölüm "Eşzamanlılık: Scope + Channel + Event Loop" olarak yeniden yazılsın (Değişmez 7'nin 3 katmanı). `spawn` sözdizimi çıkarılsın. |

### 🔴-2 `spawn` meta description — `ozellikler.html:6`

`content="... spawn/channel, self-hosting"` — sayfa açıklamasında, arama
motorlarına giden metin. **Öneri:** sil, "scope + channel" yaz.

### 🔴-3 Eşzamanlılık dokümantasyonu — `docs.html:284-317`

| | |
|---|---|
| **İddia** | "Eşzamanlılık — Spawn & Channel" başlığı + `spawn`/`end spawn` ⇄ `başlat`/`başlat sonu` keyword tablosu |
| **Aykırı** | Değişmez 7 (aynı) |
| **Derleyici** | Aynı — 0 define |
| **Öneri** | **Değiştir** — Değişmez 7'nin timing modeliyle yeniden yazılsın |

### 🔴-4 `async`/`await` envanter satırı — `inventory.html:219-221`

| | |
|---|---|
| **İddia** | "async / await / spawn · ⚠️ Kısmi · Derleniyor ve senkron olarak doğru çalışıyor. `spawn` thread başlatır." |
| **Aykırı** | Değişmez 7 satır 133 + 144 (thread pool ❌) |
| **Derleyici** | "Derleniyor ve doğru çalışıyor" **yanlış** — 0 define üretiyor. "`spawn` thread başlatır" da **yanlış** — IR'de sıfır `pthread`/`clone`/`fork` çağrısı var |
| **Öneri** | **Sil** — iki ayrı olgusal yanlış içeriyor |

### 🔴-5 "Gerçek async runtime" yol haritası — `inventory.html:288-290`

| | |
|---|---|
| **İddia** | "Gerçek async runtime · 🗓 Beta / Stage 2 · Event loop, Promise sistemi, non-blocking I/O" |
| **Aykırı** | Değişmez 7: `Promise`/`Future` ❌ ithal kalıp. **Bu bir yol haritası vaadi** — yani kanonun reddettiği şeyi gelecekte yapacağımızı söylüyor |
| **Öneri** | **Değiştir** — "Event loop + channel olgunlaşması" (Promise sözü çıkar; event loop zaten kanonik Katman 3) |

### 🔴-6 `continue` — `inventory.html:343`

| | |
|---|---|
| **Aykırı** | `TASARIM_DEGISMEZLERI.md:236` — "`continue` keyword'ü (MELP'te yok) → Değişmez 2 ihlali" |
| **Derleyici** | exit=1, derleme hatası (doğru davranış) |
| **Öneri** | Bağlamına bakılmalı — envanterde "yok" olarak listeleniyorsa doğru; "var" diyorsa sil |

---

## 🟡 KATEGORİ 2 — ÇELİŞKİLİ

### 🟡-1 `spawn` kendisiyle çelişiyor — `inventory.html:221` vs `373`

- Satır 221: "Derleniyor ve senkron olarak **doğru çalışıyor**"
- Satır 373: "`async`/`await`/`spawn` kullanan programlar Web IDE'de
  **derlenemiyor. Geçersiz WASM bytecode üretiyor.**"

Aynı sayfa, aynı özellik, iki zıt hüküm. **Derleyici gerçeği 373'ü
doğruluyor** (0 define). **Öneri:** 221 silinsin, 373 kalsın.

### 🟡-2 Web IDE WASM sürümü bayat — `web-ide/wasm/WASM_VERSION`

`build_date: 2026-04-03`, `source: STAGE0/compiler/stage1/...` — Nisan
tarihli, STAGE0 kaynaklı. Site "tam özellikli MELP derleyicisi" diyor
(`kurulum.html:67`). **Not:** WASM güncelleme bu talimatın dışı (BF:
"dokunma"), ama iddia dili buna göre kalibre edilmeli.
**Öneri:** "tam özellikli" → "derleyicinin tarayıcı sürümü" + sürüm notu.

---

## 🟢 KATEGORİ 3 — GERÇEK ama DAMGA/SÜRÜM YANLIŞ

### 🟢-1 `lambda` — `docs.html:237-238`

Derleniyor (1 define) ✅ ama `STABILITY_CONTRACT.md` deneysel listesinde
(#3: "lambda, → · sözdizimi stabil değil"). **Öneri:** 🔬 damgası ekle.

### 🟢-2 Generics `<T>` — `inventory.html:288`

"⚠️ Kısmi" damgalı — `STABILITY_CONTRACT` deneysel #7 ile tutarlı.
**Öneri:** damga sistemi ✅/🔬/⏸️'ye çevrilsin (site geneliyle uyum).

### 🟢-3 `docs.html` tip tablosu — satır 140-141

`none` / `null` satırları var. Kanon (`05_DIL_OZET`) üç tip diyor:
`numeric`, `string`, `boolean`. **"OK bir değerdir, void yoktur"** —
`none` bu modele aykırı; `null` ise Değişmez 3'ün reddettiği kavram.
**Öneri:** iki satır silinsin, yerine "OK (birim değer)" açıklaması.

---

## KARAR SORULARI (BF + proje sahibi)

Talimat gereği her 🔴 için tek soru: **silinsin mi, yoksa "MELP'te neden
YOK" diye anlatılsın mı?**

| # | Konu | Seçenek A: SİL | Seçenek B: ANLAT |
|---|---|---|---|
| 1 | `spawn` (ozellikler §4) | Bölüm tamamen çıkar | "Eşzamanlılık: neden `spawn` yok" — scope+channel+event loop üç katmanı anlatılır; ithal kalıpların neden reddedildiği bir tasarım kararı olarak sunulur |
| 2 | `async`/`await` (docs, inventory) | Satırlar çıkar | "MELP'te `async` yoktur çünkü scope zaten zamanı yönetir — `http_get()` otomatik yield eder, ayrı bir işaretleme gerekmez" |
| 3 | "Gerçek async runtime" (yol haritası) | Satır çıkar | "Promise sistemi gelmeyecek; event loop olgunlaşacak" — vaadin yönü düzeltilir |
| 4 | `continue`, `tuple`, `null`, `none` | Satırlar çıkar | "Reddedilmiş kavramlar" bölümü — her biri hangi Değişmez'e göre neden yok |

**MM görüşü (öneri, karar değil):** 1-2-3 için **B**, 4 için **A**.

Gerekçe: Değişmez 7'nin kendisi zaten bir *anlatı* — "10 kavram tek çatı
altında: Scope + Channel + Event Loop". Bunu sitede anlatmak, MELP'in en
güçlü tasarım argümanlarından birini vitrine taşır; sessizce silmek ise
"eşzamanlılık desteği yok" izlenimi bırakır ki bu yanlıştır. Ama 4.
gruptaki tekil keyword'ler (tuple, null, continue) bir anlatı taşımıyor,
yalnızca gürültü — silinmeleri yeterli.

**Ek karar gereken:** `spawn`'ın sessiz çöküşü (0 define, exit=0) bir
**derleyici hatası**dır ve site işi değildir. `ORTAK/dil/*/keywords.json`
dosyalarında `spawn`/`async`/`await` hâlâ kayıtlı — yani dilin sözlüğü
Değişmez 7 ile çelişiyor. Bu bulgunun derleyici tarafına iletilmesi
gerekiyor (MM yetkisi dışı, PDA/BF kararı).

---

## KAPSAM NOTU

Taranan: 11 HTML sayfası (kod örnekleri, özellik kartları, tablolar,
meta açıklamalar, envanter satırları). `demo.html` ve
`playground_selftest.html` içindeki `async`/`await`/`Promise` kullanımları
**JavaScript**tir, MELP iddiası değildir — kapsam dışı bırakıldı.

*WEB MM — 19 Temmuz 2026*
