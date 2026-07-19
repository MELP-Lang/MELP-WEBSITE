# melp.dev Benchmark Verileri — BF Ölçümü (kaynaklı, protokollü)

> **BF_02, 19 Temmuz 2026** | benchmark.html BU sayfadaki sayılarla kurulur.
> Anayasa (`DURUSTLUK_ANAYASASI.md`) gereği: kaynaklı, protokollü, saman-adam yok.
> Bu tablo eski (24 Haz BORU-5) ölçümlerin TAMAMINI geçersiz kılar.

## PROTOKOL (sayfaya AYNEN yazılır — denetlenebilirlik)
- **Makine:** Intel Core i7-10750H @ 2.60GHz, 12 thread, Linux
- **Derleyiciler:** MELP v1.0 + clang 22.1.8 (-O2) · gcc 14.2 (-O2) ·
  rustc 1.93.0 (-O) · go 1.25.7
- **Yöntem:** her test 5 kez koşuldu, **en iyi** raporlandı (soğuk-başlangıç
  gürültüsü elenir); tüm diller AYNI makinede, AYNI turda.
- **Adillik:** her dilin kaynağı `benchmark/*.{mlp,c,rs,go}` reposunda
  açık; C referansı deyimsel (string100k.c `len` değişkeni tutar —
  saman-adam strlen DEĞİL, 19 Tem düzeltildi).

## SONUÇLAR

### fib(40) — özyineleme (katlanamaz, gerçek CPU işi)
| Dil | Süre | Not |
|-----|------|-----|
| **C** (clang -O2) | **232ms** | **MELP'in backend eşi** — adil kıyas |
| **MELP** (clang -O2) | **234ms** | clang-C ile PRATİKTE ÖZDEŞ (aynı LLVM) |
| Rust (-O) | 277ms | MELP'ten yavaş |
| Go | 429ms | |
| — C (gcc -O2) | 171ms | dipnot: en hızlı C (farklı backend) |

**METODOLOJİ NOTU (kanonik):** MELP LLVM/clang ile derlenir. Adil C
eşleştirmesi de clang-O2'dir (aynı optimize edici, tek değişken=dil):
**MELP 234ms ≈ clang-C 232ms — özdeş.** gcc-O2 (171ms) "en hızlı C"
olarak dipnotta verilir, saklanmaz; ama ana kıyas clang-C'dir.

**Dürüst manşet:** "MELP, kendi backend'i clang ile derlenen C ile
pratikte ÖZDEŞ (234≈232); Rust/Go'dan hızlı. LLVM hiçbir şey
kaybettirmiyor." Abartı yok — ve "C ligi"nin en somut kanıtı.

### string concat 100K (`&`) — O(n) doğrulaması
| Dil | Süre | Not |
|-----|------|-----|
| **C** / **Rust** | **~1ms** | sabit-katsayı önde |
| **MELP** | **9ms** | O(n) parite (1758ms→9ms, Sprint F-M) |
| Go | 378ms | kendi string modeli yavaş |

**Dürüst manşet:** "O(n²)→O(n) çözüldü; C/Rust ile aynı karmaşıklık
sınıfı, sabit-katsayıda geride." index.html'deki eski "her ikisi ~15ms"
YANLIŞ — bu tablo geçerli.

### ⚠️ "TORPİL DENETİMİ" — her hız satırı objdump ile doğrulandı
Okuyucu haklı olarak sorar: "C/Rust bu testte LLVM'in katlamasından
yararlanıp döngüyü hiç koşmuyor olabilir mi?" Cevap: HAYIR, ve bu
disassemble ile kanıtlandı (BF, 19 Tem):
- **string100k C binary'si**: `main`'de `cmp $0x186a0` (=100000 sayaç) +
  `call realloc@plt` + geri-`jmp` → döngü FİİLEN koşuyor. Her adım gerçek
  bellek ayırma/kopyalama = **yan etkili**, LLVM katlayamaz (malloc'u
  silmek davranışı değiştirir). Bu GERÇEK bir CPU ölçümüdür.
- **loop100m** ise yan-etkisiz (`x=x+1`) → LLVM katlar → aşağıda, tablo DIŞI.
**Kural:** Hız tablosundaki HER satır "döngü canlı mı" diye objdump ile
denetlenmiştir; katlanan test hız tablosuna GİREMEZ (yalnız optimize notu).

### loop 100M — HIZ TABLOSUNA GİRMEZ
LLVM induction-variable elimination döngüyü compile-time katlar. Bu
optimize-EDİLEBİLİRLİK göstergesidir (MELP'in IR'ı temiz → LLVM
katlayabiliyor), çalışma-zamanı ölçümü DEĞİL. Ayrı not olarak, hız
tablosunun DIŞINDA sunulur.

## SAYFA ÇERÇEVESİ (anayasa konumlanması)
Başlık: "Performans — C Ligi, Sürprizsiz" (C'den hızlı DEĞİL). Övünç
değil güven. fib'de Rust/Go'yu geçmek gerçek ama tek satır — manşet
"C'yi geçtik" olamaz.

*BF_02 — 19 Temmuz 2026*
