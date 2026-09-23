# İnceleme eksiklerinin tamamlanması

23 Eylül 2026. Yerel değişiklikler; push ve deploy yapılmadı.

| Bulgu | Tamamlanan iş | Kanıt |
| --- | --- | --- |
| Odak/görünüm kaybı | Sonuç ekranı korunuyor; yalnız export onayı sıfırlanıyor. Alan tercihleri filtre ve sayfalar arasında kalıyor. | src/Review.tsx; tests/e2e/review-queue.spec.ts |
| Audit alan özeti | Arayüz ve audit bütün ham alan farkları için aynı hesabı kullanıyor. | src/core/review-state.ts; tests/review-state.test.ts |
| Kesinlik dili | İç etiketler yerine karşılaştırma skoru ve olasılık olmadığı açıklaması. | src/core/export.ts |
| Sınırsız liste | Beş grup/sayfa, kişi araması, durum filtresi ve sonraki bekleyen grup. | src/Review.tsx |
| Tek kayıt ayırma | Üç veya fazla kayıttan tek satır ayrı tutulup geri alınabiliyor. Seçili satır ayrılırsa yeni seçim gerekiyor. | tests/review-state.test.ts; tests/e2e/review-queue.spec.ts |

Audit şeması 3 orijinal grup büyüklüğünü, satır sonucunu ve seçim/ayırma/geri alma adımlarını kaydediyor. Ayrılan satır final CSV'de kalıyor. Alan birleştirme veya CRM değişikliği yapılmıyor.

## Ayrı kontrol turu

Onaylı gruplar filtresinde seçim değişince kartın kaybolmasıyla oluşan odak kaybı bulundu ve düzeltildi; odak kuyruğa taşınıyor. Regresyon senaryosu eklendi. Sonraki grup aramasındaki iç içe indeks araması kaldırıldı. Seçimsizlik testinin zayıf seçicisi düzeltildi; gerçekten işaretli radyo sayısını ölçüyor.

Karar sonrası audit/final onay sıfırlanması, özel alanlar, ayrı satır korunması, geri alma ve filtre altında tam export doğrulandı. 1440 px masaüstü ve 320 px mobil görüntüler incelendi; mobil sayfa taşması yok.

94 birim testi ve 8 Chromium uçtan uca testi geçti. Build ve lint başarılı. Build mevcut landing Vercel insights klasik script'i için paketleme uyarısı veriyor; checker'a ağ izni eklenmedi.

## Yerel ölçüm

`node scripts/review-ui-benchmark.mjs`: 2.000 sentetik satır / 1.000 aday grup; tarama ve sonuç görünmesi 444 ms, onay 81 ms, sayfa geçişi 83 ms, arama 49 ms. DOM'da beş grup; uygulama hatası yok.

[Ham ölçüm](../benchmarks/review-ui-2026-09-23.json). Tek yerel Chromium koşusu; otomasyon ve iki animation frame dahil. Tarama eşleştirmeyi içerir. Cihazlar arası performans veya rakiplere üstünlük kanıtı değildir.

Bilinçli ertelenen oturum kaydı, alan birleştirme, yeni dosya türleri ve CRM entegrasyonu eklenmedi. Gerçek export geri bildirimi ve rakiplerin aynı veriyle karşılaştırılması ürün doğrulama işi olarak devam ediyor.
