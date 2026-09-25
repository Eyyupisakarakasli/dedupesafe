# Güncel görseller — 25 Eylül 2026

Studio tasarımıyla yerel production build üzerinde yeniden üretildi. Uygulamanın 15 sentetik demo kişisini gösterir; gerçek müşteri sonucu değildir.

- 01-mapping.png: kolon eşlemesi.
- 02-review.png: onaylanmamış Charlie grubunun kaynak alan karşılaştırması.
- 03-export.png: bir grup onaylandıktan sonraki son export kontrolü. Audit indirilmedi ve son onay verilmedi; reviewed CSV indirme kapalı.
- 04-dark-review.png: onaylanmış Charlie grubunun nötr koyu tema görünümü.
- [Demo GIF](../../demo.gif): audit ve son onay dahil ayrı prova. Çıktı 14 satır olarak dosyadan doğrulandı. Kasıtlı duraklamalar içerir; performans ölçümü değildir.

Üretim: scripts/capture-screenshot.ts ve scripts/capture-demo.ts.

Sunum açıklaması: Synthetic demo contacts; no customer data. Candidate matches require review. Nothing changes inside HubSpot.
