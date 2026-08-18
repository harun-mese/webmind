# WebMind

Tarayıcıda çalışan, çevrimdışı kullanılabilen ve verileri cihazda saklayan minimal bir zihin haritası ve not uygulaması.

## Özellikler

- Tuvalde çift tıklayarak fikir oluşturma
- Düğüm başlığını çift tıklayarak düzenleme ve düğümleri sürükleme
- Düğümler arasında yönlü, yönsüz veya çift yönlü SVG bağlantılar
- Kavisli, düz ve dirsekli; kesintisiz, kesikli ve noktalı bağlantı stilleri
- Noktalı, kareli, çizgili veya boş canvas deseni ve özelleştirilebilir renkler
- Her fikir için not, etiket ve renk
- IndexedDB ile otomatik kayıt ve undo/redo
- JSON yedekleme ve geri yükleme
- Service worker ile çevrimdışı kullanım ve kurulabilir PWA

## Çalıştırma

Uygulama herhangi bir derleme adımı veya harici bağımlılık gerektirmez. Service worker ve ES modüller nedeniyle bir yerel HTTP sunucusu kullanın:

```bash
python3 -m http.server 4173
```

Ardından `http://localhost:4173` adresini açın.

## Kullanım

- Boş canvas alanına **çift tıklayın**: yeni fikir
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
