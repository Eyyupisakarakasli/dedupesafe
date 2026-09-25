# DedupeSafe gönderim paketi — 23 Eylül 2026

Durum: metin ve görseller hazır; tanıtım yayımlanmadı. Eski 59 numaralı nottaki fiyat/paywall ve “free forever” merkezli gönderiler yerine bu paket kullanılacak.

## Başlamadan önce

- E-posta: iki yönlü teslim doğrulandı; ilk ürün mesajı Gmail Spam klasörüne düştü. Erişilebilirlik konusu açık. [Sonuçlar](results-2026-09-25.md).
- HubSpot import/export provası: tamam. 6 yeni kayıt / 0 import hatası; canlı checker 2 aday grup buldu. Reviewed CSV 5 satır / 213 kolon; audit kaynak alan karşılaştırması geçti. [Kanıt](rehearsal-verification-2026-09-25.json).
- Kanal kontrolü: tamam; sonuç doğrudan tanıtım için uygun değil. r/hubspot yalnız başka kullanıcı doğrudan istediğinde ürün önerisine izin veriyor. Community reklam için izin istiyor. Ayrıntı: [kanal kontrolü](channels.md).
- Dört kampanya sayfası ve analytics script: HTTP 200; sayfalarda ürün e-postası ve noindex var. Yeni pageview'in panelde görünmesi bu turda kontrol edilmedi. [Ham HTTP kontrolü](live-checks.json).
- Canlı demo: 15 kişi / 7 aday grup; bir onay sonrası 14 satır. Audit indirme başlatıldı, ayrı son onay olmadan export düğmesi kapalıydı. Bu sentetik prova, HubSpot hesabından export provası veya gerçek kullanıcı doğruluğu değildir.

## Dosyalar

- [İngilizce gönderiler, yanıtlar ve izin talepleri](copy.md)
- [Kanal kuralları ve yayın kararı](channels.md)
- [Prova akışı](rehearsal.md), [sentetik import dosyası](hubspot-rehearsal.csv)
- [Katılımcı takip tablosu](participants.csv), [yayın takip tablosu](campaigns.csv)
- [Güncel görseller](assets/README.md)

## Operasyon

İlk yayın günü Gün 0. Hedef 30 günde yetkili olduğu gerçek export'u çalıştırıp somut sonuç bildiren 10–20 farklı kişi. Demo, beğeni, ziyaret ve kurucu provası sayılmaz. Aynı kişi bir kez sayılır. Başarısız denemeleri ayrı kaydet. Danışman/ajans ve kendi portalını yönetenleri ayır.

Bir paylaşım için tarih, gerçek yayın URL'si, kural/izin kanıtı, kampanya yolu ve görünürlük kaydı oluştur. İlk 24 saatin sayfa görüntülenmesini QA ziyaretlerinden ayrı değerlendir. Sayfa görüntülenmesi tarama veya dönüşüm değildir. Katılımcı tablosuna müşteri CSV'si, audit, gerçek kişi alanları veya e-posta adresi koyma.

Üç kapı kapanmadan topluluk tanıtımı başlatma. İlk turda tek izinli bağlamı kullan; aynı topluluğa iki segment gönderisini arka arkaya atma. Gelen somut sorulara cevap ver; yanıtsız kişilere otomatik takip gönderme.

## 25 Eylül güncellemesi

Demo ve ekran görüntüsü scriptleri güncel arayüze uyarlandı ve yerel production build üzerinde çalıştırıldı. Audit öncesinde reviewed CSV kapalı; audit 14 satır / şema 3, reviewed CSV 14 satır olarak dosyadan doğrulandı. Build ve lint geçti. Bu kontrol HubSpot import/export provasının yerine geçmez.

Yeni [demo GIF](../demo.gif) ve [ekran görüntüsü](../product-screenshot.png) hazır. Hesap provası tamamlandı; [25 Eylül sonuçları](results-2026-09-25.md) esas alınmalı. İlk mesajın Spam’e düşmesi ve kanal izni açık; paylaşım yapılmadı.
