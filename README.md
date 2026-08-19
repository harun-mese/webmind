# WebMind

Tarayıcıda çalışan, çevrimdışı kullanılabilen ve verileri cihazda saklayan minimal bir zihin haritası ve not uygulaması.

## Özellikler

- Tuvalde çift tıklayarak fikir oluşturma
- Üstteki **Yeni öğe** menüsüyle metin, görsel, YouTube videosu ve dosya kartları ekleme
- Faviconlu web sitesi kartları, Google Maps konumları ve oynatılabilir müzik öğeleri
- Açılıp kapatılabilen görsel, başlık ve açıklamalı web sitesi metadata önizlemeleri
- Dosya veya bağlantıdan görsel; dosya, doğrudan ses URL'si veya YouTube'dan müzik ekleme
- Görseller için orijinal oran, kare, rounded ve circle çerçeve seçenekleri
- Öğe bazında None ve Borderless dahil farklı kart stilleri
- İsteğe bağlı, tamamen silinebilen başlıklar ve satır/renk/kalın/altı çizili biçimlendirmeli rich text öğeleri
- Stil, seçim ve detay işlemlerinde iframe/video/harita/ses DOM'unu yerinde koruyan, hareket sırasında frame-sınırlı canvas çizimi
- Başlık, alt başlık ve medya içeriğini üç farklı sırada yerleştirebilme
- Alt başlığı canvas üzerinde çift tıklayarak doğrudan düzenleyebilme
- Başlık ve alt başlıkta kelime bazlı seçim; kalın, italik, altı çizili, vurgu ve renk balonu
- Yalnızca gerçek tıklamada açılan detay paneli ve panelden düzenlenebilen harici öğe bağlantıları
- Header detay toggle’ı ve More düğmesinden açılan öğe ayarları context menüsü
- Detay panelinden bağımsız, context menü seçenekleri için merkezde açılan öğe ayarları modalı
- Blur kullanmayan, değişiklikleri anında canvas’a yansıtan ve görsel stil presetleri sunan ayar modalı
- Canvas tıklamalarından etkilenmeyen, yalnızca header toggle ile açılıp kapanan detay paneli
- Mobilde tam yükseklik harita drawer’ı ve seçili öğedeki More düğmesinden açılan bottom sheet detayları
- Mobil canvas üzerinde iki parmakla merkeze sabit pinch-to-zoom desteği
- Mikrofondan doğrudan ses kaydı oluşturma, önizleme ve canvas üzerinde oynatma
- Sade SVG kontrolleri, ilerleme çizgisi ve süre göstergeli özel ses oynatıcı
- Liste ikonuyla animasyonlu olarak açılan, başlangıçta kapalı harita paneli
- Ayrı dairesel kontrollerden oluşan şeffaf ve minimal araç çubuğu
- Düğüm başlığını çift tıklayarak düzenleme ve düğümleri sürükleme
- Metne göre büyüyen, maksimum genişliği sınırlı metin kartları ve başlık hizalama
- Metin kartlarında sürüklenebilir genişlik tutamacı; medya kartlarında small, medium ve large boyutları
- Düğümler arasında yönlü, yönsüz veya çift yönlü SVG bağlantılar
- Bağlantı noktasındaki iki butondan otomatik ya da fare/kalem/dokunmayla çizilen bağlantı seçimi
- Kavisli, düz ve dirsekli; kesintisiz, kesikli ve noktalı bağlantı stilleri
- Kavis korunurken hedef itemin merkezine yönelen ok uçları ve bağlantı kalınlığı ayarı
- Minimal bağlantı panelinde sekiz hazır ok rengi ve özel renk seçici
- Itemlerin üzerinden serbestçe geçebilen bağlantılar
- Canlı SVG önizlemeli; düzeltilmiş dalga ve döngü ile yay, hilal ve zikzak arrow yolları
- Rich text için sarı, mavi, yeşil ve pembe mark renkleri
- Noktalı, kareli, çizgili veya boş canvas deseni ve özelleştirilebilir renkler
- Her öğe için yumuşak kart, yapışkan not, çizgisel veya cam görünüm stili
- Metin, görsel, YouTube ve dosya grupları için ayrı toplu stil varsayılanları
- Canvas rengine göre otomatik kontrast sağlayan bordersız araç ikonları
- Light, dark ve beş pastel canvas tema paketi
- Şeffaf, kapsül, eskiz ve dolu seçenekleri dahil sekiz öğe stili
- Rengi kaldırma seçeneği, genişletilmiş item paleti ve beş yaratıcı yazı karakteri
- Item bazında yazı boyutu ve seçili kelimeler için balon biçimlendirme editörü
- Her fikir için not, etiket ve renk
- IndexedDB ile otomatik kayıt ve undo/redo
- JSON yedekleme ve geri yükleme
- Service worker ile çevrimdışı kullanım ve kurulabilir PWA
- Canvas hareketinde video iframe'lerini yeniden oluşturmayan kararlı viewport

## Çalıştırma

Uygulama herhangi bir derleme adımı veya harici bağımlılık gerektirmez. Service worker ve ES modüller nedeniyle bir yerel HTTP sunucusu kullanın:

```bash
python3 -m http.server 4173
```

Ardından `http://localhost:4173` adresini açın.

## Kullanım

- Boş canvas alanına **çift tıklayın**: yeni fikir
- **Yeni öğe** düğmesine basın: görsel, YouTube videosu veya dosya ekleyin
- Bir fikre **çift tıklayın**: başlığı düzenle
- Bir fikri **sürükleyin**: konumunu değiştir
- Fikrin sağındaki küçük noktayı başka bir fikre **sürükleyin**: bağlantı oluştur
- Bağlantı noktasına tıklayıp **Otomatik** veya **Çiz** yöntemini seçin; ardından bir öğeden diğerine sürükleyin
- Bir bağlantıya **tıklayın**: yön, form, çizgi, renk ve etiket ayarları
- Boş alanı **sürükleyin**: canvas'ı hareket ettir
- Fare tekerleği: yakınlaştır/uzaklaştır
- `Ctrl/Cmd + Z`: geri al

Ayrıntılı ürün ve teknik plan için [docs/PLAN.md](docs/PLAN.md) dosyasına bakın.

## Veri ve gizlilik

Haritalar IndexedDB içinde yalnızca kullanıcının tarayıcısında saklanır. WebMind herhangi bir sunucuya kullanıcı verisi göndermez. Araç çubuundaki içe/dışa aktarma kontrolleriyle JSON yedeği alınabilir.
