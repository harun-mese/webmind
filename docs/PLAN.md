# WebMind Ürün ve Teknik Planı

## Amaç

WebMind; fikirlerin serbestçe yerleştirildiği, notlarla zenginleştirildiği ve isteğe bağlı oklarla ilişkilendirildiği, tamamen tarayıcıda ve çevrimdışı çalışan minimal bir zihin haritası uygulamasıdır.

## Teknoloji

Uygulama vanilla HTML, CSS ve ES module JavaScript ile geliştirilir. Düğümler erişilebilir DOM elemanları, bağlantılar SVG path'leri, kalıcı veri IndexedDB ve çevrimdışı uygulama kabuğu bir service worker ile sağlanır.

## Tamamlanan MVP kapsamı

- Çoklu harita oluşturma ve haritalar arasında geçiş
- Tam ekran canvas üzerinde yüzen araç çubuğu, harita listesi ve detay paneli
- Çift tıklamayla düğüm oluşturma ve yerinde başlık düzenleme
- Metin, yerel görsel, YouTube videosu ve indirilebilir dosya öğeleri
- Pointer Events ile düğüm ve canvas sürükleme
- SVG üzerinden düğümler arası bağlantı oluşturma
- Yönsüz, ileri, geri ve çift yönlü bağlantılar
- Kavisli, düz ve dirsekli bağlantı formları
- Kesintisiz, kesikli ve noktalı çizgiler
- Bağlantı etiketi ve özel renk
- Nokta, kare, çizgi veya boş canvas deseni
- Canvas, desen ve varsayılan bağlantı rengi ayarı
- Düğüm notları, etiketler ve renk paleti
- IndexedDB otomatik kaydı
- Undo/redo geçmişi
- JSON içe ve dışa aktarma
- PWA manifesti ve çevrimdışı önbellek

## Veri modeli

Çalışma alanı sürüm, aktif harita ve harita listesini tutar. Her harita kendi viewport, görünüm, düğüm ve bağlantı kayıtlarına sahiptir. Bir bağlantı; kaynak, hedef, etiket, renk, yön, çizgi deseni ve yol formunu saklar. Bu yapı daha sonra şema migration'ları ve bulut senkronizasyonuyla genişletilebilir.

## Sonraki aşamalar

1. Klavyeyle düğüm ve bağlantı oluşturma akışını geliştirmek.
2. Harita silme/yeniden adlandırma menüsü ve onay iletişim kutuları eklemek.
3. IndexedDB şema migration katmanı oluşturmak.
4. Undo geçmişini işlem tabanlı hale getirerek bellek kullanımını azaltmak.
5. Otomatik bağlantı noktası seçimini ve paralel bağlantı kavislerini geliştirmek.
6. Mobil bağlantı modu ve alt sayfa kontrollerini eklemek.
7. Birim, erişilebilirlik ve tarayıcı uçtan uca testleri eklemek.
8. Font dosyasını proje içine alarak tipografinin çevrimdışı paketlenmesini tamamlamak.
