# Hesap provaları

25 Eylül: import/export ve iki yönlü e-posta provasını yürüttük. İlk ürün mesajı Gmail Spam klasörüne düştü. [Sonuç ve kanıtlar](results-2026-09-25.md). Aşağıdaki akış tekrarlar için korunmuştur.

## E-posta

Konu: DedupeSafe delivery check YYYY-MM-DD. Gövde: “Delivery test only. No customer data. Please reply with RECEIVED.”

Kullanıcının belirttiği ikinci kendi hesabından ürün kutusuna gönder; ürün kutusunda mesajı gör; aynı zincirden yanıtla; ikinci kutuda yanıtı doğrula. Gelen/Gönderilmiş/Junk konumunu ve saatleri kaydet. Gönderildi bildirimi teslimat kanıtı değildir. Kendine aynı kutudan gönderme, dış teslimat provası yerine geçmez. Bu task kapsamında sadece bu teslimat testi için mesaj gönderimi yetkili; tanıtım/izin talebi gönderimi yapılmadı.

## HubSpot

1. Oturum açıldıktan sonra hedef portalın yalnız test için kullanıldığını ve planını doğrula. Gerçek müşteri portalına sentetik kişi ekleme. Yeni hesap, ödeme veya plan yükseltme yapma.
2. hubspot-rehearsal.csv dosyasındaki altı uydurma kişiyi Contacts olarak içeri al. Eşlemeleri ve import sonucunu kaydet; gerçek adres kullanma, marketing e-postası veya workflow tetikleme.
3. DSQA260923 Example şirket adıyla filtreleyerek yalnız bu kayıtları CSV olarak dışarı al. Record ID ve Job Title dahil alanları koru. İngilizce sütun adlarını seç; hem dosyayı hem import/export sayılarını sakla.
4. HubSpot'tan alınan dosyayı DedupeSafe'te aç. Yerel hazırlanan CSV ile değiştirme. Beklenen niyet: Ayla ve Mert için ikişer kayıt, iki bağımsız kişi. Gerçek sonucu kaydet; farklılığı gizleme.
5. Bir grubu onayla; diğerini ayrı tut. Altı kayıt gerçekten export edilmişse beklenen çıktı beş satırdır. Audit tüm aday kaynak değerlerini, reviewed CSV seçilen satırı ve onaysız kayıtları korumalı. Record ID ile karşılaştır.
6. Duplicate yönetimi ekranına erişimi ve görülen plan kısıtını kaydet; belgeyi okumayı hesapta görmüş gibi yazma. Çıktıyı HubSpot'a geri import etme; portal cleanup iddiası üretme.
7. Saat, portalın test niteliği, plan, import sayısı, export sayısı, adaylar, final satırlar ve gözlenen farkları rapora ekle. Prova gerçek kullanıcı hedefine sayılmaz.

Doğrudan okunan export yolu: CRM > Contacts, ilgili görünüm, Export; CSV ve alan kapsamını seç. Export izni gerekli. [Resmî export belgesi](https://knowledge.hubspot.com/import-and-export/export-records). Ekrandaki gerçek seçenekler esas alınacak.
