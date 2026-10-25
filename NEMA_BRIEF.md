# Nema — Proje Devir Dosyası (yeni Claude oturumu için)

> Bu dosyayı `Nema_Proje_Analizi_Final.pdf` ile birlikte ver. PDF pitch/analiz belgesidir; bu dosya alınmış kararları, kesin adresleri ve kuralları içerir. Çelişki olursa **bu dosya geçerlidir**.
> Hazırlanma: 22 Ekim 2026. Etkinlik: HackMeridian 2026, 25–26 Ekim, Lizbon.

## 1. Proje tek cümlede
**Nema: Stellar'ın ilk USDT0 tabanlı getiri kasası (yield vault).** Kullanıcı USDT0 yatırır, cüzdanına **nUSDT0** (pay/makbuz token) gelir; kasa USDT0'ı XOXNO (lending) ve Aquarius (LP) stratejilerine dağıtır; nUSDT0'ın USDT0 karşısındaki değeri zamanla artar.

## 2. Alınmış kararlar (yeniden tartışma)
- İsim: **Nema**, token: **nUSDT0**.
- Kategori: **yield vault**. "Staking" kelimesi KULLANILMAZ (teknik olarak yanlış).
- Lending protokolü YAZMIYORUZ; XOXNO'yu strateji olarak kullanıyoruz.
- Yeni stablecoin veya yeni DEX YOK.
- DeFindex arayüzü USDT0'ı desteklemiyor → **kendi kasa kontratımız** (DeFindex açık kaynak kodu referans olabilir).
- nUSDT0: **klasik Stellar varlığı, SAC admin = kasa kontratı** (tüm cüzdanlarda görünür, DEX'te işlem görür). Kullanıcı trustline'ı yatırma işlemine eklenir.
- Non-custodial: ekip kullanıcı fonu tutmaz; admin (multisig) sadece durdurabilir, fon gönderemez; çekim her zaman açık.
- Demo önceliği: **XOXNO stratejisi**. Aquarius stratejisi (concentrated likidite) "sonraki adım".
- USDT0 testnet'te YOK → demoda **mock USDT0** (testnet'te kendi SAC'ımız) ve bu jüriye açıkça söylenir.

## 3. Kapsam dışı (kullanıcı açıkça istemedi)
LayerZero köprüsü, transfer takibi, trustline kontrol aracı, genel gasless ödeme, standart escrow, P2P rampa, anchor işletmek.

## 4. Kesin mainnet adresleri (StellarExpert ile doğrulandı, 21–22 Ekim 2026)
| Ne | Adres |
|---|---|
| USDT0 SAC | `CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF` |
| USDT0 classic issuer (kilitli) | `GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q` |
| USDC SAC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| XOXNO Controller (kullanıcı giriş noktası) | `CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX` |
| XOXNO Central Pool | `CBXRNDQMAJFG4VUKMKFEMFS75UUXE2SPSNV4LEEFCSNBCN66PYRWBKXO` |
| Aquarius USDT0/USDC havuzu (concentrated, AQUA ödüllü) | `CCJHUCHZ2DC6MP7LMGQJYSENNTGIFWU4J4TCGFYYDLAC5LTD4YMF6HSQ` |
| Aquarius Router | `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK` |
| yUSDT (rakip referansı, Axelar) | `CCOVLDJCH3S552AOUKS2M5AMWORG5KNPMBCS3EQI6G5RPPKQPQHB6F6G` |

Testnet adresleri: henüz alınmadı (XOXNO ve Aquarius ekiplerinden Discord ile istenecek).

## 5. Entegrasyon notları
- API değil, **kontrattan kontrata çağrı**.
- XOXNO (`XOXNO/rs-lending-xlm`, `docs/reference/endpoints.md`):
  - `supply(caller, account_id, spoke_id, assets) -> u64` — `account_id = 0` yeni hesap açar; `assets = Vec<(HubAssetKey{hub_id, asset}, amount)>`.
  - `withdraw(caller, account_id, withdrawals, to)` — miktar 0 = tamamını çek.
  - Pozisyon = hesap NFT'si; sahibi kasa kontratı olabilir (XOXNO'nun DeFindex adaptörü bunu yapıyor → `defindex-strategy` kontratı iyi referans).
- Aquarius: `AquaToken/soroban-amm` (router, stableswap, concentrated). Herkese açık API: `amm-api.aqua.network/pools/?search=USDT0`, `reward-api.aqua.network/api/rewards/`.
- Fiyat/peg: RedStone USDT0 SEP-40 feed'i (adresi henüz alınmadı).
- Arayüzün gerçek arayüzünü dökmek için: `stellar contract info interface --id <adres> --network mainnet`.

## 6. Ölçülen piyasa verisi (pitch için)
- USDT0 arzı ≈ 7,03 M; trustline 30.099; **bakiyeli hesap 307**.
- Getiri: XOXNO USDT0 yatırma **%0,76** (TVL ≈ 47,5 bin $); Aquarius USDT0/USDC **%0,34** (TVL ≈ 2,48 M $, günlük ≈ 100 bin AQUA). Gerçekçi kasa APY'si ≈ **%0,4–0,8**.
- Blend'de USDT0 yok. DeFindex'te USDT0 seçilemiyor. Upshift/Gami, Sentora (Stellar DeFi Hub), Meridian kasaları USDC/XLM/PYUSD.

## 7. Doğru iddia ve dikkat
- Doğru: "Stellar'ın ilk USDT0 tabanlı, getirisini Stellar içinde üreten kasası."
- Yanlış: "Stellar'ın ilk faiz getiren USDT'si" (yUSDT var).
- En büyük zayıflık düşük APY → pitch "30.099 trustline / 307 bakiye: USDT0 boşta duruyor" hikâyesine yaslanır.

## 8. Teknik tuzaklar
Share inflation (ilk yatıran saldırısı) → sanal pay ofseti / ilk payı kilitle; yuvarlama kasa lehine; Soroban kaynak limitleri (stratejileri ayrı işlemlerle dengele); TTL uzatma; oracle eşiği ile koruma modu.

## 9. Açık sorular
1. ~~Demo mu pitch mi?~~ **Karar (22 Ekim): geliştirme yapılacak, çalışan demo (B planı).** "Geliştirme yok" kısıtı sadece fikir bulma aşaması içindi.
2. Token adında "USDT0" kullanımı marka açısından uygun mu?
3. Testnet adresleri (XOXNO, Aquarius, RedStone).
