# melp.dev Dürüstlük Anayasası — İçerik Elden Geçirme Sözleşmesi

> # 🏛️ NORMATİF | **BF_02, 19 Temmuz 2026**
> Bu belge, melp.dev'i elden geçirecek herkes (alt-ajan dahil) için
> BAĞLAYICIDIR. Buradaki sayı ve iddia dışında hiçbir şey siteye giremez.
> İhlal = yayın reddi.

## TEMEL KURAL
Sitedeki HER sayı BF ölçümünden gelir (aşağıda). HER özellik iddiası
`MELP_KANONİK/OZGUN_OZELLIKLER.md`'den gelir — dürüstlük satırlarıyla
BİRLİKTE. Ölçülmeyen sayı, kanıtlanmamış iddia YAZILMAZ.

## GERÇEK BENCHMARK (BF ölçümü, 19 Tem, -O2, en iyi/3)

| Test | MELP | C (clang-O2, backend eşi) | Dürüst yorum |
|---|---|---|---|
| fib(40) | **234ms** | **232ms** | PRATİKTE ÖZDEŞ (aynı LLVM); gcc-C 171ms dipnot |
| string100k | **9ms** | ~1ms | O(n) parite; C sabit-katsayıda önde |
| loop100m | ⚠️ ÖLÇÜM DEĞİL | — | LLVM katlaması; HIZ tablosuna GİRMEZ |

> **Kanonik C referansı = clang-O2** (MELP'in backend'i). gcc-O2 daha hızlı
> (fib 171ms) ama farklı backend — "en hızlı C" dipnotu olarak verilir,
> ana kıyas clang'dır. Rust 277ms / Go 429ms (fib) — MELP ikisinden hızlı.
> Tam veri + protokol: `WEB/BENCHMARK_VERILERI.md`.

## YASAKLI İFADELER (siteden SİLİNECEK)
- ❌ "C'den Hızlı Olduğu Yerler Var" başlığı → ✅ "C ile Aynı Ligde"
- ❌ "fib 233ms / C 238ms / 0.98x MELP hızlı!" → ✅ "232ms / 179ms / C önde, parite"
- ❌ loop100m "2ms vs 134ms" hız tablosunda → ✅ ayrı "optimize-edilebilirlik" notu
- ❌ "647x daha hızlı" dış-kıyas iması → ✅ yalnız "eski API içi iyileşme; gerçek: O(n²)→O(n)"
- ❌ herhangi "X kat hızlı / beats C" → sadece protokollü, kaynaklı, dürüst yorumlu

## DOĞRU ANLATI (konumlanma)
melp.dev "daha hızlı Electron/C" DEĞİL. Kategori: *GUI dile aittir,
state yönetimi yok, freeze/karantina, debug=geleceğe mektup.* Performans
= "C ligi, sürprizsiz" (övünç değil, güven). Açılış: OZGUN_OZELLIKLER §0
(yaralar haritası) — ❌'lar DAHİL (tedarik zinciri yok, araç zinciri genç).

## DURUM DAMGALARI (özellik iddialarında)
✅ kanıtlı · 🔬 kısmi · ⏸️ tasarım. OZGUN_OZELLIKLER'deki damga siteye
AYNEN taşınır. Örn: freeze ✅/🔬 (host-API çalışır, dil sözdizimi Evre 2);
"state yönetimi yok" 🔬 (Melpion masaüstü, büyük uygulama kanıtlanmadı).

## PLAYGROUND KARARI (BF, 19 Tem — kritik)
Site ŞU AN yanlış playground'u gösteriyor:
- `playground.html`/`melp-playground.html` = DEMO oynatıcı (sabit senaryolar).
- **`playground_textarea.html` = GERÇEK: textarea + `compiler-worker.js` →
  `wasm/melp_compiler_v2.wasm` ile kullanıcı kodunu DERLEYİP çalıştırır.**
**Yapılacak:** Ana "Playground" linki GERÇEK olana (textarea) gitmeli.
Demo-oynatıcı ayrı "Örnekler/Demo" sayfası olarak kalabilir. Bu, defterin
10. maddesinin ("tarayıcıda gerçek self-hosted derleyici") kanıtı —
vitrine çıkmalı. WASM'ın gerçekliği KORUNUR (Ç1 kazanımı).
> REPL (E1, `melp repl` host'u var) web'e ayrı sekme olarak gömülebilir —
> durum korunur (`>>> x=5` → `>>> x+1` → 6). Playground = tam program;
> REPL = etkileşimli. Aynı WASM derleyiciyi paylaşan İKİ sekme ideali.
> Bu YENİ iş — Evre 1 kapsamı DEĞİL, ayrı madde (öneri: çevre birimleri turu).

## TEKNİK ELDEN GEÇİRME (mekanik — alt-ajan işi)
1. Tek CSS sistemi: `index.html` kanonik; benchmark.html + playground +
   sonradan eklenen sayfalar AYNI CSS'e uyar. **Doğru playground =
   textarea sürümü** (yukarı); onu CSS'e bağla, demo'yu ayrı tut.
2. Kırık/eski linkler onarılır; her sayfa aynı nav'ı paylaşır.
3. Tema uyumu (varsa açık/koyu), responsive.
4. Logo: kanonik SVG (varsa `WEB/assets/`).

## SÜREÇ
- Alt-ajan uygular; BF YAYINDAN ÖNCE her sayfayı okur.
- Yeni sayı/iddia gerekiyorsa → BF'ye sorulur, uydurulmaz.
- Playground'un GERÇEK WASM olduğu korunur (simülasyon değil — mevcut kazanım).

*BF_02 — 19 Temmuz 2026*
