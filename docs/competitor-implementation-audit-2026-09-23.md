# Rakip analizi: uygulama kontrolü

23 Eylül 2026. Önceki rakip özellik analizinin mevcut yerel koda göre kontrolüdür; yeni rakip hesap testi veya güncel fiyat araştırması değildir. Üretici beyanlarına dayanan önceki araştırmanın sınırları devam ediyor. Bu kontrolde ürün kodu değişmedi.

## Tamamlananlar

- Korunacak satırı kullanıcı seçebiliyor. App.tsx: selectRow.
- Seçim değişikliği ilgili grubun onayını kaldırıyor; audit indirme önkoşulu ve final onayı sıfırlanıyor.
- Kaynak sütunları ve özel alan farkları SourceFields içinde görünüyor. Farklı değerler işaretleniyor.
- Audit şema 2: keep-one-row / keep-all-rows / unreviewed; Matching score; Selected row; Values to review.
- Skor ana karar başlığından ayrıldı. Mobil kayıtlar alan adlarıyla okunuyor.
- Yerel işleme, açık onay ve tam kaynak audit'i korundu.

Kanıt: src/App.tsx, src/core/export.ts, tests/e2e/row-selection.spec.ts, docs/audit-schema.md. Bu kontrolde tüm test paketi yeniden koşturulmadı; aşağıdaki iki bulgu hedefli tarayıcı senaryosuyla tekrarlandı.

## Kısmen kalanlar ve yeni bulgular

### 1. Karar değişince bütün sonuç ekranı yeniden kuruluyor

App.tsx:281'de ResultsStep key'i seçim ve kararlarla değişiyor. Bu, final onayı sıfırlamak için kullanılmış; ancak arayüz durumunu da siliyor.

Tekrar: özel alanlı iki satırlı dosya aç, Show all original fields seç, başka satırı seç. Kontrol tekrar işaretsiz oluyor; document.activeElement BODY oluyor. Bu, klavyeyle sonraki işlemi yapmayı zorlaştırıyor.

Öneri: audit/final onayını hedefli sıfırla. Görünüm tercihlerini koru; seçimde odağı aynı kontrolde, onayda uygun sonraki grupta tut. Güvenlik önkoşullarını gevşetme.

### 2. Audit özeti tüm kaynak alanları kapsamıyor

src/core/export.ts:56 buildMergeSuggestions yalnız belli normalize alanları kontrol ediyor. Özel alanları ve iki dolu telefon/şirket değeri arasındaki bazı farkları özetlemiyor.

Tekrar: aynı kimlik alanlarına sahip iki satır, yalnız ikinci satırda Custom Note=ONLY_ON_SECOND. İlk satır seçilip onaylandığında audit'te Values to review boş; Source 4: Custom Note içinde değer var.

Sonuç: kaynak audit'inde veri kaybı yok. Eksik olan risk özeti; arayüzde görülen tüm farklarla tutarlı değil.

Öneri: kaynak alan farklarını tek ortak yardımcıyla üret; arayüz ve audit aynı sonucu kullansın. Normalize alan özeti ile kaynak değeri kaybını karıştırma.

### 3. Kesinlik dili audit'te kısmen duruyor

src/core/export.ts:112, Matching score değerinin sonuna riskLevel ekliyor; certain hâlâ kullanıcı çıktısında görülebiliyor. Başlık düzeldi fakat kimlik kesinliği izlenimi tamamen kalkmadı.

Öneri: kullanıcıya “certain” vermeden skorun karşılaştırma puanı olduğunu belirt; iç eşik sınıfları uygulama ayrıntısı kalsın.

### 4. Geniş kaynak görünümü uzun listeyi büyüttü

src/App.tsx:546 bütün bekleyen grupları render ediyor; SourceFields farklı alan varsa açık geliyor. Arama, durum filtresi, sayfalama/limit ve sonraki bekleyen grup akışı yok.

Kod bulgusu: sınırlandırılmamış render var. Gerçek büyük veri render/tıklama gecikmesi bu kontrolde ölçülmedi; ölçülmüş performans sorunu gibi sunulmamalı.

Öneri: sonraki uygulama paketi inceleme kuyruğu olsun. Doğrulama sadece matcher hızını değil ekranın açılmasını ve karar sonrası tepkiyi de ölçsün.

### 5. Gruptan tek kayıt ayırma yok

Grup için keep-one-row veya keep-all-rows var. A/B aynı kişi, C farklı kişi durumunda A/B'yi birleştirip C'yi ayrı tutma kararı ifade edilemiyor.

Mevcut güvenli yol tüm grubu ayrı tutmak. Bu nedenle otomatik veri kaybı hatası değil, karar kapasitesi eksikliği. Gerçek exportlarda bu örnekler görülürse önceliği artar.

## Bilinçli ertelenenler

Oturum kaydet/aç, kontrollü alan birleştirme, alternatif dosya türleri, çoklu dosya ve e-postasız akış için kullanıcı ihtiyacı doğrulanmadı. CRM OAuth, otomatik toplu karar, LLM, enrichment ve ekip hesaplarını eklememe önerisi sürüyor. Bu listenin tamamı “bitmemiş zorunlu iş” değildir.

## Analizin kendi sınırları

Önceki analiz üretici dokümanlarını karşılaştırdı; ürünlerin yanlış eşleşme oranını aynı veri setinde ölçmedi. Dedupely ayrıntılı doğrulanmadı, fiyatlar bu çalışmada yenilenmedi. Gerçek kullanıcıların alan seçimi, kısmi grup kararı ve oturum sürdürme ihtiyacı henüz ölçülmedi. Bu nedenle “rakiplerden daha doğru” veya “en iyi performans” sonucu çıkarılamaz.

## Önerilen sıra

Önce odak/görünüm kaybı, ortak alan farkı özeti ve audit kesinlik dili. Ardından inceleme kuyruğu. Kısmi grup kararı için gerçek export örneklerini topla; diğer kapsamları beklet.

Tüm önceki P0 işlerinin hiç eksiksiz kapandığını söylemek fazla güçlü olur: satır seçimi ve alan görünümü işlevsel, fakat görünüm sürekliliği ve audit özeti için bir tamamlama turu gerekiyor.

## Tamamlama turu — güncel durum

Yukarıdaki ilk kontrolün beş bulgusu yerel uygulamada kapatıldı. Önceki eksik durumları, satır numaraları ve şema 2 ifadeleri tarihsel kayıttır; güncel şema 3. Ayrı kontrol turu ve kanıtlar: [tamamlama raporu](review-completion-2026-09-23.md). Push veya deploy yapılmadı.
