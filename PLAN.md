# Nema — Uygulama Planı (HackMeridian 2026, B planı: çalışan demo)

> Kaynak: `NEMA_BRIEF.md` (çelişkide geçerli olan) + `Nema_Proje_Analizi_Final.pdf`. Hazırlanma: 22 Ekim 2026.
> Kararlar (22 Ekim): XOXNO = mock-lending ile demo + gerçek adaptör kodu hazır · Frontend = Next.js · Maskot = SVG (Claude çizer).
> Hedef: 25 Ekim sabahı testnet'te uçtan uca çalışan demo — yatır → nUSDT0 al → pay fiyatı artıyor → getiri dağılımı → çek.

## 1. Repo yapısı

```
nema/
├── contracts/                 # Soroban (Rust) workspace
│   ├── vault/                 # Nema kasası (asıl ürün)
│   ├── strategy-xoxno/        # XOXNO adaptörü (demo önceliği)
│   ├── mock-lending/          # XOXNO testnet adresi gelmezse yedek: faiz biriktiren sahte pool
│   ├── mock-oracle/           # SEP-40 mock (RedStone testnet feed'i gelene kadar)
│   ├── interfaces/            # ortak Strategy / XOXNO / SEP-40 client trait'leri
│   └── integration-tests/     # vault + adaptör + mock lending, gerçek auth ağaçlarıyla
├── backend/                   # Node + TypeScript
│   ├── src/api/               # Hono: /stats, /apy, /history, /faucet
│   ├── src/keeper/            # harvest + rebalance cron (izinsiz, herkes tetikleyebilir)
│   └── src/indexer/           # kasa olaylarını okuyup pay fiyatı geçmişi tutar
├── frontend/                  # Next.js (App Router) + TS + Tailwind
│   ├── src/contracts/         # `stellar contract bindings typescript` çıktısı
│   ├── src/wallet/            # Stellar Wallets Kit (Freighter, Lobstr, xBull)
│   └── src/illustrations/     # Nema balık maskotu + sahne SVG'leri
├── scripts/                   # deploy-testnet.sh, mock USDT0 SAC, seed
└── PLAN.md
```

## 2. Akıllı kontratlar

### 2.1 `vault` (Nema Kasası)
| Fonksiyon | Davranış |
|---|---|
| `__constructor(admin, usdt0, n_token_sac, fee_bps, buffer_bps)` | `admin` = multisig hesap. nUSDT0 SAC'ının admin'i deploy sonrası kasaya devredilir. |
| `deposit(from, assets, min_shares) -> shares` | `from.require_auth()`; USDT0 `transfer` → kasa; pay hesapla (**aşağı yuvarla**); nUSDT0 SAC `mint`. Duraklatılmışsa / koruma modundaysa reddet. |
| `withdraw(from, shares, min_assets) -> assets` | nUSDT0 `burn`; varlık hesapla (**aşağı yuvarla** → kasa lehine); tampon yetmezse stratejiden çek. **Pause'da bile açık.** |
| `total_assets()` | boştaki USDT0 + Σ `strategy.balance()` |
| `share_price()` / `preview_deposit` / `preview_withdraw` | UI için salt okunur |
| `harvest()` | izinsiz; stratejilerden kazancı raporlar, kârın %10'u kadar pay `fee_recipient`'a basılır (ana paradan ücret yok) |
| `rebalance(strategy, target_bps)` | izinsiz ama **tavanlara** (`max_bps`) ve tampona (%5) bağlı; tek işlemde tek strateji (Soroban kaynak limiti) |
| `pause() / unpause()` | yalnızca admin; **fon transferi yetkisi yok** |
| `set_guard(oracle, max_depeg_bps)` | RedStone SEP-40 okuma; eşik aşılırsa deposit durur, risk stratejisinden çekilir |

**Güvenlik kuralları (testlerle kilitlenecek):**
- Share inflation: sanal ofset — `shares = assets * (supply + 10^3) / (total + 1)` (OpenZeppelin ERC-4626 kalıbı) + ilk depozitte `MIN_LOCKED_SHARES` ölü adrese.
- Yuvarlama her zaman kasa lehine.
- Admin anahtarıyla kullanıcı fonunu taşıyan hiçbir yol yok (test: admin ile `transfer` denemesi başarısız olmalı).
- TTL: instance `extend_ttl` her çağrıda; `bump()` izinsiz fonksiyonu keeper'dan çağrılır.
- Olaylar: `deposit`, `withdraw`, `harvest`, `rebalance` → indexer bunlardan beslenir.

### 2.2 `strategy-xoxno`
- `deposit(amount)`, `withdraw(amount) -> u128`, `balance() -> u128`, `harvest() -> i128` — sadece kasa çağırabilir.
- XOXNO Controller: `supply(caller, account_id, spoke_id, assets)`, `withdraw(caller, account_id, withdrawals, to)`. İlk supply'da `account_id = 0` → dönen hesap NFT id'si storage'a yazılır; sahibi adaptör kontratı.
- Referans: XOXNO'nun `defindex-strategy` kontratı. Gerçek imzalar: `stellar contract info interface --id CAUCMI…E5JX --network mainnet`.

### 2.3 `mock-lending` (yedek)
XOXNO testnet adresi Discord'dan gelmezse: aynı `supply/withdraw` arayüzü, yıllık oranı ayarlanabilir (demo için hızlandırılmış) faiz biriktirir. Jüriye açıkça söylenir; mainnet entegrasyon kodu yine `strategy-xoxno`'da durur.

### 2.4 Mock USDT0 ve nUSDT0
- `stellar contract asset deploy` ile testnet'te `USDT0:<bizim issuer>` SAC'ı (brief: "mock USDT0, jüriye açıkça söylenir").
- nUSDT0 klasik varlık + SAC; `set_admin(vault)`. Deposit işlemine kullanıcının `change_trust` op'u eklenir (frontend tarafında tek imza).

## 3. Backend (Node + TS, Hono)
| Modül | Görev |
|---|---|
| `GET /stats` | Mainnet canlı veri: USDT0 arzı, trustline (30.099), bakiyeli hesap (307) — StellarExpert API, 10 dk cache. Pitch kancası. |
| `GET /apy` | XOXNO (DefiLlama Yields) + Aquarius (`amm-api.aqua.network`) mainnet oranları; kasa harmanlanmış APY |
| `GET /history` | indexer'dan pay fiyatı zaman serisi (grafik için) |
| `POST /faucet` | demo için adrese 1.000 mock USDT0 (rate limit) |
| keeper | cron: `harvest` → `rebalance` → `bump`; ayrı işlemler. Keeper anahtarı yetkisiz (herkes çağırabilir). |

Not: Backend kullanıcı fonuna dokunmaz; tüm yatır/çek imzaları tarayıcıda cüzdanla atılır.

## 4. Frontend — tasarım dili
**"Apple netliği + çizgi roman karakteri"**: Düzen, boşluk, tipografi Apple gibi sade; kahraman alanı ve boş durumlar elle çizilmiş gibi illüstrasyon.

- **Palet**: okyanus mavisi `#1E5BFF` (birincil), derin lacivert `#0B1E4A`, palyaço balığı turuncusu `#FF7A1A` (aksiyon/vurgu), krem `#FFF4E0` (illüstrasyon başlıkları), açık zemin `#F5F7FB`. Koyu modda lacivert zemin.
- **Tipografi**: arayüz `-apple-system / SF Pro` → yedek Inter; sadece hero başlığında kalın retro "comic display" font (örn. Bowlby One / Rubik Mono), krem dolgu + kalın siyah kontur — referans görseldeki "IN THE POND" gibi.
- **Maskot**: kurbağa yerine **turuncu-beyaz palyaço balığı "Nema"** — kalın siyah kontur, düz renk dolgu, yarı kapalı rahat bakış (referanstaki tembel/keyifli tavır), elinde nilüfer yaprağı şemsiye yerine küçük bir deniz kabuğu/coin. *Disney'in Nemo'sunun birebir kopyası değil, özgün çizim* (telif + jüri önünde risk).
- **Sahne**: hero'da mavi gökyüzü + bulutlar + su yüzeyi; balık suda yaslanmış. SVG katmanlı, hafif parallax / dalga animasyonu.
- **Bileşenler**: Apple tarzı büyük yuvarlak köşeli kartlar (radius 24–28), buzlu cam (`backdrop-blur`) üst bar, segment kontrol (Yatır | Çek), büyük sayı göstergeleri, ince grafikler.

### Ekranlar
1. **Ana sayfa** — Hero (maskot + "Nema" başlığı + "USDT0'ın boşta beklemesin"), canlı mainnet kartı "30.099 trustline · 307 bakiye", 3 adımda nasıl çalışır, güvenlik (non-custodial, çekim her zaman açık).
2. **Kasa (`/app`)** — Cüzdan bağla; Yatır/Çek kartı (önizleme: alacağın nUSDT0 / USDT0); pozisyonun; pay fiyatı grafiği; **getiri dağılımı** (XOXNO faizi %x · Aquarius komisyon %y · AQUA ödülü %z — Aquarius "yakında"); strateji tahsisi halkası; "Test USDT0 al" faucet butonu (testnet rozeti ile).
3. **Şeffaflık (`/transparency`)** — kontrat adresleri (StellarExpert linkleri), admin yetkileri, tavanlar, oracle durumu.

Metin kuralı: hiçbir yerde "staking" yok; "getiri kasası / yield vault".

## 5. Takvim (bugün 22 Ekim → demo 25 Ekim)
| Gün | İş |
|---|---|
| **22 Ekim** | Workspace iskeleti; `vault` kontratı + birim testleri (inflation, yuvarlama, pause'da çekim); mock USDT0 + nUSDT0 SAC testnet deploy script'i. XOXNO/Aquarius Discord'a testnet adresi isteği. |
| **23 Ekim** | `strategy-xoxno` (+ `mock-lending` yedeği); entegrasyon testi; testnet deploy; TS bindings. Frontend iskeleti, tasarım token'ları, maskot SVG'si. |
| **24 Ekim** | Frontend: cüzdan, yatır/çek, grafik, getiri dağılımı. Backend: /stats, /apy, faucet, keeper. Uçtan uca prova; Vercel deploy. |
| **25 Ekim** | Cila, demo senaryosu, yedek video kaydı, pitch slaytlarına ekran görüntüleri. |

## 6. "Sonraki adım" olarak gösterilecekler (kodlanmayacak)
Aquarius concentrated LP stratejisi, AQUA compound, Reflector ikinci oracle, mainnet denetimi, cüzdan "Earn" sekmesi entegrasyonu.

## 7. Açık riskler
1. XOXNO testnet adresi gelmezse → `mock-lending` (karar bugün verilmeli).
2. RedStone USDT0 testnet feed'i yoksa → oracle guard'ı mock fiyat kontratıyla göster.
3. Token adında "USDT0" (marka) — demo için nUSDT0 kalır, pitch'te not düşülür.

## 8. Durum (22 Ekim, gece)
- [x] Kontratlar: vault, strategy-xoxno, mock-lending, mock-oracle — 30 test, clippy temiz
- [x] Testnet deploy script'i (`scripts/deploy-testnet.sh`), canlı deploy + seed
- [x] Backend: API, keeper, indexer, faucet; `npm run e2e` testnet'te geçti
- [x] Frontend: ana sayfa (çizimsel hero + balık maskot), `/app` kasa, `/transparency`
- [ ] Freighter ile tarayıcıdan manuel prova (Friendbot → setup → yatır → çek)
- [ ] Hosting (Vercel + backend sunucusu), demo videosu
- [ ] XOXNO testnet adresi gelirse: deploy script'inde `LENDING` yerine gerçek controller
