# DedupeSafe: rakiplerden hareketle özellik kararları

İnceleme: 22 Eylül 2026. Kapsam: mevcut yerel kod ve doğrudan açılan üretici sayfaları. Bu belge bir uygulama kararı değil, öncelik önerisidir. Kod, deploy ve push yapılmadı. Rakip özellikleri üreticilerin beyanıdır; hesap açıp uçtan uca kullanım testi yapılmadı. Kullanıcı talebi veya ödeme isteği bu araştırmayla kanıtlanmış sayılmaz.

> 23 Eylül uygulama kontrolü: aşağıdaki ilk durum bulgularının bir kısmı kapandı. Güncel durum için [uygulama kontrolünü](competitor-implementation-audit-2026-09-23.md) okuyun.

## Sonuç

Önce korunacak satırı seçme ve bütün kaynak alanlarını inceleme eksiklerini kapat. Sonra karar kuyruğunu kısa ve yönetilebilir yap. Alan birleştirme, CRM bağlantısı ve otomasyon için gerçek kullanım kanıtı bekle.

Mevcut yön: HubSpot kontakt CSV'sini CRM erişimi vermeden yerelde incelemek, adayları değerlendirmek ve kararların kaydını almak. CSV'den satır çıkarmak CRM'deki kayıtları birleştirmez. Bu sınır pazarlama ve çıktılarda açık kalmalı.

## Doğrudan incelenen rakipler

| Araç | Belgelenen özellik | DedupeSafe açısından yorum |
| --- | --- | --- |
| [Datablist](https://www.datablist.com/features/duplicates-remover) | Korunacak kaydı/değeri seçme, gruptan kayıt çıkarma, alan birleştirme, arama/sıralama, eşleşme açıklaması, işlem önizlemesi. | Dosya inceleme akışımız için en yakın karşılaştırma. Kullanıcı kontrolünü örnek al; özellik kataloğunu kopyalama. |
| [HubSpot duplicate manager](https://knowledge.hubspot.com/records/manage-duplicate-records) | İncelenecek özellikleri değiştirme, korunacak kayıt ve alanları seçme, filtreler, özel kurallar. Özellikler aboneliğe bağlı. | Kullanıcının alışık olabileceği kontrol seviyesi. Sadece beş alan göstermek karar bağlamını daraltıyor. |
| [Insycle teknik dokümanı](https://support.insycle.com/hc/en-us/articles/6585453128599-HubSpot-Merge-Duplicates-Module-Overview) | Ana kayıt ve alan saklama kuralları, boş alanları doldurma, elle inceleme ve gruplara ek alanlar getirme. | Satırı seçme ile alanları birleştirme ayrı işler. İlkini önce çöz; ikincisi için ayrı önizleme ve doğrulama gerekir. |
| [Koalify](https://koalify.io/) | HubSpot içi kurallar, CRM kartlarından birleştirme, workflow otomasyonu ve listeler/raporlar. | Sürekli portal temizliği farklı bir ürün yönü. Mevcut yerel araçta kısa vadeli hedef olmamalı. |
| [Teamopipe Contact List Cleaner](https://www.teamopipe.com/en/tools/contact-list-cleaner) | Tarayıcıda CSV işleme, yinelenen e-postaları kaldırma, ad harf düzeni ve geçersiz adres kontrolü. | Yerel işleme benzersizlik iddiası kurulamaz. Sade başlangıç korunmalı; “geçersiz adres” beyanı teslim edilebilirlik testi olarak yorumlanmamalı. |

Insycle pazarlama sayfası açılamadı; yukarıdaki destek dokümanı açılıp okundu. Dedupely ana sayfası açılamadığı için ayrıntılı özellik karşılaştırmasına alınmadı. Arama özetiyle doğrulanmış gibi yazılmadı. Fiyat araştırması bu kapsamda yapılmadı.

## 22 Eylül kod durumunda doğrulanan boşluklar (tarihsel)

- [App.tsx](../src/App.tsx): onay ve ayrı tutma var; kullanıcının başka bir masterContact seçmesine yarayan kontrol/state yok. “Keep selected row” aslında sistem önerisini onaylıyor.
- [matcher.ts](../src/core/matcher.ts): findMasterContact, eşleştirmede kullanılan beş alanın doluluğu, metin uzunluğu ve sıra üzerinden öneri seçiyor. Özel alanların iş anlamını veya kayıt sahibinin tercihini temsil etmiyor.
- [App.tsx](../src/App.tsx): GroupCard, FIELD_ORDER ile beş alan gösteriyor. Orijinal CSV'deki diğer alanlar bu görünümde yok.
- [export.ts](../src/core/export.ts): audit bütün kaynak alanlarını koruyor; reviewed CSV yalnız masterContact satırını kullanıyor. Audit'te korumak, nihai dosyada alanları birleştirmek değildir.
- [App.tsx](../src/App.tsx): pendingGroups tamamı render ediliyor; arama, sayfalama ve oturumu dosyadan geri yükleme yok. Kararlar React state içinde.
- [export.ts](../src/core/export.ts): dışarı verilen audit hâlâ Decision=merge, Confidence ve Merge suggestions adlarını kullanıyor. Arayüzdeki “alan birleştirmiyoruz” açıklamasıyla dil tutarsızlığı var.

## Eklenecekler: önerilen sıra

### P0: korunacak satırı kullanıcı seçsin

Sorun: Kullanıcı sistem önerisi yerine doğru CRM ID'sini veya doğru yaşam döngüsü aşamasını taşıyan satırı tutamıyor.

En küçük çözüm: her satırda tek seçim kontrolü. Sistem önerisi başlangıç seçimi olabilir; onay ayrı kalmalı. CSV satır numarası ve mevcutsa Record ID görünmeli.

Kabul ölçütü: başka satır seçilince reviewed CSV, audit'teki seçilen kayıt ve çıkarılacak satır sayısı aynı kararı yansıtır. Seçim değişince önceki dışa aktarma onayı ve audit önkoşulu sıfırlanır. Öneri otomatik onay olmaz.

Dayanak: yukarıdaki Datablist, HubSpot ve Insycle kayıt seçimi belgeleri. Bu öncelik ayrıca mevcut kontrol eksikliğine dayanır; kullanıcı talebi ölçülmüş değildir.

### P0: tüm alan farklarını onaydan önce göster

En küçük çözüm: “Farklı alanlar” bölümü orijinal sütunların tamamını karşılaştırsın. “Tüm alanları göster” ayrıca açılabilsin. Korunacak satırda boş olan veya farklı değer taşıyan sütunlar belirtilsin.

Örnek: bir satırda özel Customer ID doluyken önerilen satırda boşsa, kullanıcı bunu audit'i başka programda açmadan görebilsin.

Kabul ölçütü: özel alan, farklı e-posta, tarih ve çok satırlı notlar görünür; kalan CSV'de bulunmayacak kaynak değerler doğru işaretlenir. Bu sürüm alanları değiştirmez.

### P1: inceleme kuyruğu

Bekleyen / onaylanan / ayrı tutulan filtreleri, ad veya e-postayla arama, sınırlı sayıda grup gösterimi ve “sonraki bekleyen grup” bağlantısı.

Neden: hızlı tarama tek başına çok sayıda kararı yönetmeyi çözmüyor. [Datablist](https://www.datablist.com/features/duplicates-remover) arama ve sıralama sunuyor; bu gözlem DedupeSafe'te aynı ihtiyacın oluştuğunu kanıtlamaz.

Kabul ölçütü: görünmeyen gruplar karar değiştirmez; filtre/sayfa değişince seçimler korunur. Büyük sentetik sonuç setinde render ve tıklama gecikmesi ölçülür; sadece matcher süresi raporlanmaz.

### P1: gruptan tek kaydı ayırma

Örnek: A ve B aynı kişi, C yanlış bağlanmış. Mevcut tüm grubu onayla/tümünü tut ikiliği bu kararı ifade edemiyor.

En küçük çözüm: C'yi “ayrı tut” ile gruptan çıkar, A/B incelemesini sürdür. Alan birleştirme ekleme.

Kabul ölçütü: dışlanan satır eksiksiz korunur; seçili ana satır dışlanırsa yeni seçim ve yeniden onay gerekir. Audit önceki/sonraki kararları açıklamalı. Kısmi grup işlemi gerçek örneklerde görülürse öne alınabilir.

### P2: yerel inceleme oturumunu kaydet/aç

Uzun inceleme gerçekten yarıda kalıyorsa yapılmalı. İlk çözüm otomatik tarayıcı depolaması yerine kullanıcının açıkça indirdiği karar dosyası olabilir. Yeniden açarken kaynak dosya parmak izi, şema ve sürüm doğrulanmalı; farklı CSV'ye eski karar uygulanmamalı. Parmak izi ve karar dosyası da hassas olabilir.

### P2: kontrollü alan birleştirme

Ancak “doğru satırı seçmek yetmiyor, diğer satırdan değer de gerekiyor” ihtiyacı tekrarlandığında. İlk sürüm kullanıcı seçimi + nihai satır önizlemesiyle sınırlı kalsın. İzin/abonelik durumu, Record ID, yaşam döngüsü ve tarih alanları genel “boşları doldur” kuralına bırakılmasın. CRM'in birleştirme kurallarını CSV üzerinde taklit ettiğimizi iddia etmeyelim.

## Çıkarılacak veya sadeleştirilecekler

| Öğe | Öneri |
| --- | --- |
| “Keep selected row” fakat gerçek seçim yok | Seçim eklenene kadar “Keep suggested row” olarak adlandır. |
| Audit'te merge / Confidence / Merge suggestions | Kullanıcı çıktısında keep-one-row / Matching score / Values to review karşılıklarına geç. Audit şemasını sürümle; eski dosyaları sessizce farklı anlamda yorumlama. |
| “add alternative email” gibi uygulanmayan öneriler | Eylem yapılmış izlenimi yerine “diğer satırda bulunan değer” de. |
| Tekrar eden uyarı metinleri | Grup yanında somut veri kaybı, finalde işlem özeti. Aynı genel açıklamayı tekrarlama. Audit ve ayrı onay kapısını koru. |
| Her grubu açık gösterme | Filtrelenebilir kısa kuyruk; ayrıntıyı ihtiyaç halinde aç. |
| “Yalnız biz yerelde işliyoruz” veya “rakipler sadece exact eşleştiriyor” | Kullanma. İncelenen kaynaklar bunu desteklemiyor. |

E-posta sütunu zorunluluğunu hemen kaldırma: telefonla çalışan gerçek export talebi varsa alternatif giriş ölçütleri ve eksik sinyallerin davranışı test edilerek ele alınmalı.

## Şimdilik eklenmemesi gerekenler

- LLM ile otomatik kişi birleştirme veya genel “AI temizleme”.
- HubSpot OAuth, portalda otomatik değişiklik, zamanlanmış temizlik.
- Her veri tipi için özel kural oluşturucu.
- E-posta zenginleştirme veya teslim edilebilirlik hizmeti.
- Hesap, ekip alanı ve sunucuda dosya saklama.
- XLSX, çoklu dosya, çoklu CRM desteğini birlikte başlatma.
- Varsayılan “hepsini onayla”.

Bunlar gereksiz özellikler oldukları için değil, mevcut CSV inceleme işini tamamlamadan kapsamı ve doğrulama yükünü büyüttükleri için ertelenmeli.

## Dağıtıma hazırlık kararı

Önce P0 kontroller ve yanlış çağrışımlı çıktı dili. Ardından küçük bir gerçek export denemesi; sonraki özellikleri bu denemede yaşanan güçlüklerden seç.

Önerilen gözlem: kullanıcı önerilen satırı değiştirmek istiyor mu, karar için hangi alanları arıyor, bir grubu bölmesi gerekiyor mu, inceleme yarıda kalıyor mu, reviewed CSV'yi ne amaçla kullanıyor? Son soru özellikle önemli: kullanıcı portal temizliği bekliyorsa daha fazla dosya özelliği bu beklenti farkını çözmez.

İzleme: yönlendirme gereksinimi, karar süresi, geri alınan kararlar ve tamamlanan inceleme. Bunlar önerilen ölçümlerdir; mevcut üründe toplanmış sonuçlar değildir. CSV içeriği ve kişi bilgileri telemetry'ye gönderilmemeli.
