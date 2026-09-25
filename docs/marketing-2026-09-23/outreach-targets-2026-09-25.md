# İkinci dağıtım turu: hedef seçimi — 25 Eylül 2026

Durum: ilk iki hedefe yorum gönderildi; [yayın kaydı](distribution-update-2026-09-25.md) ve [takip kontrolü](follow-up-2026-09-25.md) güncel durumu içerir. Aşağıdaki taslakları tekrar gönderme. Sıralama editoryal değerlendirmedir; erişim veya dönüşüm garantisi değildir. Yeni yayın öncesinde başlık, kurallar ve mevcut yorumları yeniden oku.

## İlk sıra

### 1. Reddit / r/hubspot: temizlik iş akışı sorusu

Kaynak: https://www.reddit.com/r/hubspot/comments/1wn4dk9/need_advice_on_cleaning_up_40005000_messy_hubspot/

22 Eylül tarihli soru: yazar 4.000–5.000 şirket/kişi kaydını temizlerken geçmiş ve ilişkileri korumak, sorunları önceliklendirmek istiyor. CSV inceleme konumuzla kısmi örtüşme var; şirket temizliği, zenginleştirme ve CRM merge ürün kapsamının dışında. İstek açık bir ürün önerisi talebi değil. Bu yüzden ilk yanıt ürün adı/bağlantısı içermeyecek. Gerçek müşteri projesi deneyimimiz varmış gibi konuşulmayacak.

Kural kaynağı: https://www.reddit.com/r/hubspot/ . Kural 3'teki doğrudan talep koşulu sürüyor.

Taslak:

> I'd separate this into a review stage and a CRM-change stage. Preserve Record IDs in the review file, then take a small contact-only batch and classify each issue: suspected duplicate, missing information, or conflicting values. For a possible duplicate, check associations and activity in HubSpot before choosing a primary record; a contact CSV alone won't show the whole history. Keep a decision log with both IDs and the reason for each change. Also, reimporting a CSV with fewer rows won't merge or delete the existing CRM records. Which part is blocking you first: identifying candidates or deciding what can safely change?

Teknik dayanak: https://knowledge.hubspot.com/records/manage-duplicate-records ve doğrulanmış ürün export sınırları. Ayrıntılı bir CRM yedekleme/geri yükleme garantisi verilmez.

### 2. LinkedIn / Elvis Obi: küçük ölçekli CSV temizleme örneği

Kaynak: https://www.linkedin.com/posts/elvis-obi-831754113_contact-company-data-cleanup-in-hubspot-activity-7492395567151611904-1AoX

Doğrudan sayfa okundu. Yazar 47 kişilik spreadsheet temizleme ve şirket ilişkilendirme işini anlatıyor; sayfa yaklaşık 1 ay gösteriyor. Küçük dosya, danışman ve manuel inceleme açısından öğrenme adayı; aktif ürün arayışı değil. 25 Eylül'de yöntem sorusu ürün bağlantısı olmadan yayımlandı. Oturum ve yorum erişimi doğrulandı.

Taslak:

> How did you handle contact rows that looked like the same person but had different emails or conflicting values? I'm working on a CSV review tool and am trying to understand which decisions still need a person's judgment. Your company-association step is a separate problem from choosing which contact row to keep.

Politika: https://www.linkedin.com/legal/professional-community-policies . İlgisiz, istenmeyen ve tekrarlı tanıtım yasak; bu gönderi ürün bağlantısına davet sayılmaz. Yanıt gelirse soruya göre konuş; otomatik DM veya aynı metni başka paylaşımlara kopyalama.

## İkinci sıra / koşullu

### 3. HubSpot Community: uygun bölüm için ekip izni

https://community.hubspot.com/guidelines ve https://legal.hubspot.com/community-tou . Terms 3(b) reklam/solicitation için izin istiyor. Mevcut copy.md ekip talebi hazır. Bu, şu anda yorum atılacak onaylı bir başlık değildir; yönetici izni alınmadan tanıtım yapılmaz. Eski https://community.hubspot.com/t/merge-duplicate-contacts/28516 sorusu ücretsiz CRM ve merge konusuyla ilgili fakat eski ve ürün CRM merge yapmıyor; buraya reklam yanıtı önerilmiyor.

### 4. LinkedIn / Alexandra Muresan: karar kuralları araştırması

https://www.linkedin.com/posts/alexandra-muresan-480774176_revops-salesops-hubspot-activity-7467534724723367938-1Aod

Arama sonucu yazarın büyük ölçekli kişi eşleştirme ve Python merge iş akışını anlatıyor. Doğrudan sayfa açılışı hata verdi; tarih ve canlı yorum erişimi doğrulanmadı. DedupeSafe bu ölçek/otomasyonun çözümü olarak sunulmaz. Sayfa açılırsa birincil kayıt seçerken çelişkili alanlara yaklaşım sorulabilir. İlk tur yayın kuyruğuna alınmadı.

## Elenen veya bekleyen yerler

- https://www.reddit.com/r/hubspot/comments/1wpoahz/dirty_portal_and_merging_contacts/ : 25 Eylül, 30.000+ duplicate için toplu CRM merge arıyor; DedupeSafe çözmüyor. Ürün bağlantısı gönderme.
- https://www.reddit.com/r/hubspot/comments/1wgmnf4/tips_for_finding_duplicate_records/ : Contacts/Companies dışı nesneler ve name/address kıyaslama istiyor; ürün kapsamı uymuyor.
- https://www.reddit.com/r/hubspot/comments/1tfpzq5/for_hubspot_usersadmins_how_are_you_currently/ : yaklaşık dört aylık; yazar benzer CSV ürününü araştırıyor. Bağımsız müşteri talebi diye sayılmaz.
- https://www.linkedin.com/posts/max-reysh_ive-been-building-cleanslate-a-service-activity-7504136962358865920-ML3f : başka geliştiricinin CleanSlate tanıtımı. Rakibin yorum alanını reklam için kullanma.
- https://www.revopscoop.com/resources/community-guidelines : açık self-promotion yasağı; dağıtım kuyruğundan çıkarıldı.
- https://www.weflow.ai/community : RevOps Slack topluluğu bulunuyor; içeride ilgili başlık, hesap erişimi ve ürün tanıtımı izni doğrulanmadı. Şu an gönderim hedefi değil.
- https://www.indiehackers.com/post/how-do-you-manage-customer-data-import-issues-ac1f1b2dcf : eski genel import tartışması; güncel HubSpot kullanıcı talebi yok. Öncelik verilmedi.
- r/HubspotApps: ilk yorum zaten campaigns.csv'de kayıtlı. Aynı başlığa ikinci ürün yorumu atılmayacak.

## Uygulama ve ölçüm

İlk parti: bir Reddit iş akışı yanıtı + erişim varsa bir LinkedIn yöntem sorusu. Bunlar müşteri kazanımı değil, konuşma başlatma denemeleri. Ürün bağlantısı yalnız ilgili ve izinli bağlamda; bağlantı verildiğinde geliştirici ilişkisi açıklanır. LinkedIn için Reddit kampanya yolu kullanılmaz; mevcut genel landing kullanılabilir, kaynak takip tablosunda LinkedIn diye kaydedilir. Yeni platform için yanlış kanal ölçümü üretilmez.

Her gönderiden sonra gerçek yorum URL'si, kanal, bağlam ve tarih kaydedilir. Gerçek yetkili export kullanımı ve somut geri bildirim yoksa 10–20 kişi hedefine eklenmez. Cevap vermeyenlere otomatik takip/DM yok. Bu dosyadaki taslaklar yayımlandı diye işaretlenmez.
