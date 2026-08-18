# WebMind

Tarayıcıda çalışan, çevrimdışı kullanılabilen ve verileri cihazda saklayan minimal bir zihin haritası ve not uygulaması.

## Özellikler

- Tuvalde çift tıklayarak fikir oluşturma
- Üstteki **Yeni öğe** menüsüyle metin, görsel, YouTube videosu ve dosya kartları ekleme
- Liste ikonuyla animasyonlu olarak açılan, başlangıçta kapalı harita paneli
- Ayrı dairesel kontrollerden oluşan şeffaf ve minimal araç çubuğu
- Düğüm başlığını çift tıklayarak düzenleme ve düğümleri sürükleme
- Metne göre büyüyen, maksimum genişliği sınırlı metin kartları ve başlık hizalama
- Metin kartlarında sürüklenebilir genişlik tutamacı; medya kartlarında small, medium ve large boyutları
- Düğümler arasında yönlü, yönsüz veya çift yönlü SVG bağlantılar
- Kavisli, düz ve dirsekli; kesintisiz, kesikli ve noktalı bağlantı stilleri
- Noktalı, kareli, çizgili veya boş canvas deseni ve özelleştirilebilir renkler
- Her öğe için yumuşak kart, yapışkan not, çizgisel veya cam görünüm stili
- Metin, görsel, YouTube ve dosya grupları için ayrı toplu stil varsayılanları
- Canvas rengine göre otomatik kontrast sağlayan bordersız araç ikonları
- Light, dark ve beş pastel canvas tema paketi
- Şeffaf, kapsül, eskiz ve dolu seçenekleri dahil sekiz öğe stili
- Rengi kaldırma seçeneği, genişletilmiş item paleti ve beş yaratıcı yazı karakteri
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
- Bir bağlantıya **tıklayın**: yön, form, çizgi, renk ve etiket ayarları
- Boş alanı **sürükleyin**: canvas'ı hareket ettir
- Fare tekerleği: yakınlaştır/uzaklaştır
- `Ctrl/Cmd + Z`: geri al

Ayrıntılı ürün ve teknik plan için [docs/PLAN.md](docs/PLAN.md) dosyasına bakın.

## Veri ve gizlilik

Haritalar IndexedDB içinde yalnızca kullanıcının tarayıcısında saklanır. WebMind herhangi bir sunucuya kullanıcı verisi göndermez. Araç çubuundaki içe/dışa aktarma kontrolleriyle JSON yedeği alınabilir.
