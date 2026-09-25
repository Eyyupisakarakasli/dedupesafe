# DedupeSafe gönderim paketi — 23 Eylül 2026

## Güncel durum — 25 Eylül

İlk tanıtıma ek olarak Reddit ve LinkedIn’de iki yöntem yorumu yayımlandı ve doğrulandı. Studio görselleri ve demo yenilendi. İlk tanıtıma bir dizin önerisi yanıtı geldi; gerçek kullanım anlatmıyor. Henüz doğrulanmış nitel katılımcı yok. [Son takip kontrolü](follow-up-2026-09-25.md). [Yayın kanıtları ve sonraki adımlar](distribution-update-2026-09-25.md) güncel durumun kaynağıdır; aşağıdaki hazırlık kayıtlarının yerine geçer.

## İlk yayın kaydı

25 Eylül 2026: kullanıcı onayıyla ilk iki cümlelik yorum yayımlandı. https://www.reddit.com/r/HubspotApps/comments/1wkg5ol/comment/pbxuodw/ . Oturum açık tarayıcıda Yorum gönderildi bildirimi, metin ve doğru kampanya bağlantısı doğrulandı. Oturum dışı erişim doğrulanmadı (bağımsız web okuması Cache miss). Gün 0: 25 Eylül; 30 günlük değerlendirme: 25 Ekim 2026. Doğrulama saati 09:46 UTC / 12:46 Türkiye; bu saat kesin gönderim saniyesi değildir. İlk 24 saatlik sayım henüz alınmadı; önceki tek QA ziyareti yayın öncesidir.

Aşağıdaki yayın öncesi durumlar tarihsel kayıttır.

Durum: metin ve görseller hazır; tanıtım yayımlanmadı. Eski 59 numaralı nottaki fiyat/paywall ve “free forever” merkezli gönderiler yerine bu paket kullanılacak.

## Başlamadan önce

- E-posta: iki yönlü teslim doğrulandı; ilk ürün mesajı Gmail Spam klasörüne düştü. SPF/DKIM/DMARC PASS. İlk dağıtımda topluluk yanıtı birincil, e-posta ikincil kanal. [Sonuçlar](results-2026-09-25.md).
- HubSpot import/export provası: tamam. 6 yeni kayıt / 0 import hatası; canlı checker 2 aday grup buldu. Reviewed CSV 5 satır / 213 kolon; audit kaynak alan karşılaştırması geçti. [Kanıt](rehearsal-verification-2026-09-25.json).
- Kanal kontrolü: r/HubspotApps tanıtım başlığında iki cümlelik yorum için uygun bağlam bulundu. r/hubspot yalnız başka kullanıcı doğrudan istediğinde ürün önerisine izin veriyor. Community reklam için izin istiyor. Ayrıntı: [kanal kontrolü](channels.md).
- Dört kampanya sayfası ve analytics script: HTTP 200; sayfalarda ürün e-postası ve noindex var. 25 Eylül tek QA ziyareti panelde /for/owners/reddit için 1 ziyaretçi / 1 pageview olarak görüldü. [Ham HTTP kontrolü](live-checks.json).
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

Teknik prova ve ölçüm kapıları kapandı; e-posta riskine karşı topluluk yanıtı kullanılacak. Kullanıcının gönderim talimatıyla üç yorum yayımlandı; kayıtlar campaigns.csv içinde. İlk turda tek izinli bağlamı kullan; aynı topluluğa iki segment gönderisini arka arkaya atma. Gelen somut sorulara cevap ver; yanıtsız kişilere otomatik takip gönderme.

## 25 Eylül güncellemesi

Demo ve ekran görüntüsü scriptleri güncel arayüze uyarlandı ve yerel production build üzerinde çalıştırıldı. Audit öncesinde reviewed CSV kapalı; audit 14 satır / şema 3, reviewed CSV 14 satır olarak dosyadan doğrulandı. Build ve lint geçti. Bu kontrol HubSpot import/export provasının yerine geçmez.

Yeni [demo GIF](../demo.gif) ve [ekran görüntüsü](../product-screenshot.png) hazır. Hesap provası tamamlandı; [25 Eylül sonuçları](results-2026-09-25.md) esas alınmalı. İlk mesajın Spam’e düşmesi açık risk; izinli tanıtım başlığı ve aynı zincirden geri bildirim planı hazır. Yayınlar ve son takip sonucu üstteki kayıtlardadır.

## İkinci tur hedef araştırması

[Platformlar, somut başlıklar, elenen yerler ve yanıt taslakları](outreach-targets-2026-09-25.md). Bu araştırma turunda yeni yorum yayımlanmadı.
