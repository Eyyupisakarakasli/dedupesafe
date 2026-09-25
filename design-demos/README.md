# Tasarım denemeleri

Canlı dosyalardan bağımsız, yerel prototipler. Üçü aynı kurgusal veri ve aynı karar akışını kullanır; böylece görsel tercihler karşılaştırılabilir.

A / Workspace: #f3f6fb zemin, #ffffff yüzey, #172438 metin, #245dcc vurgu, #dce3ee çizgi. Segoe UI. Solda kısa giriş ve dosya bilgisi, sağda gerçek boyutlu inceleme alanı. Odak: ürünü ilk ekranda kullanmak.
B / Ledger: #fafafa zemin, #ffffff yüzey, #24262a metin, #394b65 vurgu, #d5d7db çizgi. Georgia başlık, Segoe UI kontroller. Soldan hizalı editoryal başlık ve tam genişlikte karşılaştırma föyü. Odak: kararın gerekçesini okumak.
C / Console: #151b24 zemin, #1e2734 yüzey, #e9eef6 metin, #efbc75 uyarı, #344255 çizgi. Segoe UI, Consolas veri etiketleri. Kompakt başlık, solda inceleme kuyruğu, sağda açık karşılaştırma. Odak: yoğun inceleme işi.

İlk plan kontrolü: yalnız renk değişimi yeterli değil. Bu yüzden A bölünmüş giriş, B yatay föy, C kuyruklu uygulama düzeni kullanıyor. Sahte metrik, dekoratif grafik, iddialı başarı sözü yok. Örnek kişiler .example alan adlarını kullanıyor. Dil seçimi, farklı kayıt seçimi, satır kararı ve geri alma çalışacak. Gerçek CSV yükleme mevcut araca yönlenecek.

## Doğrulama

- JS sözdizimi kontrolü geçti.
- A: B satırı seçildi, onaylandı; 5/6 satır kaldı. Almancaya geçildiğinde karar korundu. Geri alındığında 6/6 oldu.
- B: fark filtresi aynı değerleri gizledi.
- C: iki kaydı tut kararı 6/6 satırı korudu.
- A/B/C: 390px viewport içinde belge genişliği 375px; yatay sayfa taşması yok. A/C masaüstünde 1440px viewport içinde 1425px belge genişliği.
- Gerçek araç bağlantısı localhost:4175/app/ HTTP 200.
- Üretim dosyaları değiştirilmedi; commit/push/deploy yapılmadı.

## Claude CLI durumu

Claude CLI çağrıldı fakat OAuth oturumu sona erdiği ve yenilenemediği için tasarım görüşü alınamadı. `claude auth status` loggedIn=false döndü. Kullanıcıdan `claude auth login` istendi. claude-design-review.md bir tasarım görüşü değil, başarısız çağrının çıktısıdır.

## Kaynak

Anthropic Frontend Design: https://github.com/anthropics/skills/tree/main/skills/frontend-design
Rehber okundu ve uygulandı; global skill kurulumu yapılmadı. Mevcut tarayıcı eklentisiyle doğrulandı.

Çalıştırma: `node design-demos/server.mjs` (127.0.0.1:4180).

## İkinci tasarım turu — A/B tercihinden sonra

- D / Focus: beyaz zemin, ortalanmış ince başlık, tek okuma ekseni, dar inceleme föyü. #ffffff / #222a30 / #284c62. Segoe UI. En az görsel bölünme.
- E / Folio: B'nin serif karakteri, solda dar editoryal giriş, sağda çerçevesiz karşılaştırma. #f8f9fa / #28313a / #465d74. Georgia + Segoe UI. En belirgin tipografik kimlik.
- F / Studio: kısa yatay giriş, tek beyaz çalışma yüzeyi, solda inceleme kuyruğu. #f2f4f5 / #222b30 / #285950. Segoe UI. Ürüne en hızlı geçiş; bu turun önerisi.

A/B/C yerleşimleri korundu. Üst demo seçicisine D/E/F eklendi. Yeni varyasyonlarda gölgeler ve iç hücre çerçeveleri kaldırıldı; yalnız karşılaştırmaya yardımcı ayraçlar kaldı.

Kontrol: D/E/F 390px Almanca görünümde belge genişliği 375px, yatay taşma yok. D/F 1280px masaüstünde belge genişliği 1265px. F'de onay 5/6, dil değişimi ve geri alma 6/6 olarak doğrulandı. JS sözdizimi kontrolü geçti. Claude CLI oturumu hâlâ loggedIn=false; yeni Claude katkısı yok. Canlı siteye değişiklik yapılmadı.
