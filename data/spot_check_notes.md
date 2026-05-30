# Spot Check Notes

This file records a compact manual review sample from the cleaned dataset. The full per-category sample is `output/spot_check_sample.csv`.

Review checks applied:

- Product URL is canonical `https://enterkomputer.com/detail/...`.
- Name, SKU, category, price, stock status, and scraped timestamp are populated.
- Price is numeric after cleaning.
- `specifications` is valid JSON text.
- Empty descriptions and image URLs are accepted when caused by known scraper/site limitations.

## VGA

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 195151 | Inno3D GeForce RTX 5060 Ti 8GB GDDR7 TWIN X2 - DUAL FAN - Garansi 3 Thn | 7950000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 195155 | Inno3D GeForce RTX 5060 Ti 16GB GDDR7 TWIN X2 OC - DUAL FAN - Garansi 3 Thn | 10550000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 161565 | GALAX GeForce GT 710 2GB DDR3 - Garansi 3 Thn | 565000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 195938 | GALAX GeForce RTX 5060 8GB GDDR7 (1-Click OC) V2 - Lighting EFFECT - DUAL FAN - Garansi 3  | 6850000 | in_stock | canonical URL, valid JSON shape |
| 195128 | GALAX GeForce RTX 5060 Ti 8GB GDDR7 (1-Click OC) V2 - Lighting EFFECT - DUAL FAN - Garansi | 8050000 | in_stock | canonical URL, valid JSON shape, empty description accepted |

## Processor

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 190654 | AMD EPYC 4464P 3.7GHz Up To 5.4GHz Cache 64MB 65W AM5 [Tray] - 12 Core - 100-000001478 | 9039000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 190574 | AMD EPYC 7313 3.0Ghz Up To 3.7Ghz Cache 128MB 155W SP3 [Tray] - 16 Core - 100-000000329 | 14655000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 190575 | AMD EPYC 7352 2.3Ghz Up To 3.2Ghz Cache 128MB 155W SP3 [Tray] - 24 Core - 100-000000077 | 18979000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 190576 | AMD EPYC 7413 2.65Ghz Up To 3.6Ghz Cache 128MB 180W SP3 [Tray] - 24 Core - 100-000000323 | 19179000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 190577 | AMD EPYC 7443 2.85Ghz Up To 4.0Ghz Cache 128MB 200W SP3 [Tray] - 24 Core - 100-000000340 | 29670000 | in_stock | canonical URL, valid JSON shape, empty description accepted |

## Motherboard

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 191367 | MAXSUN Terminator B760M GKD5 ICE (LGA1700, B760, DDR5, USB3.2 Type-C, SATA3) | 2150000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 197085 | MAXSUN Challenger B850M-K (AM5, AMD B850, DDR5, USB3.2, SATA3) | 1550000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 193856 | MAXSUN iCraft Z890 ARCTIC (LGA1851, Z890, DDR5, USB3.2 Gen2x2 Type-C, SATA3) | 5500000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 193850 | MAXSUN Challenger A620A 2.5G (AM5, AMD A620, DDR5, USB3.2, SATA3) | 1400000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 184855 | ASRock B650M Pro RS (AM5, AMD B650, DDR5, USB3.2 Type-C, SATA3) | 2165000 | in_stock | canonical URL, valid JSON shape, empty description accepted |

## RAM

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 195691 | KLEVV FIT V Jet Black DDR5 PC51200 6400MHz 16GB (1x16GB) 32-38-38-78 - KD5AGU880-64A320K | 3560000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 192267 | KLEVV CRAS V RGB ROG CERTIFIED DDR5 PC57600 7200MHz 48GB (2x24GB) 34-44-44-84 - KD5KGUD80- | 10650000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 196114 | ADATA XPG LANCER BLADE RGB White Edition DDR5 PC48000 6000MHz 32GB (2x16GB) CL36-38-38 - A | 7649000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 199940 | KLEVV BOLT V Pure White DDR5 PC51200 6400MHz 32GB (2x16GB) 32-38-38-78 - KD5AGUA80-64A320I | 7640000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 199048 | KLEVV FIT V Jet Black DDR5 PC48000 6000MHz 32GB (2x16GB) 28-36-36-76 - KD5AGU880-60B280L | 7000000 | in_stock | canonical URL, valid JSON shape, empty description accepted |

## SSD

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 192269 | KLEVV SSD CRAS C715 512GB M.2 2280 NVMe PCle Gen3 x4 - K512GM2SP0-C7T - R3200MB/s W2000MB/ | 1700000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 181068 | ADATA LEGEND 710 512GB M.2 NVME R 2400MB/S W 1000MB/S | 1610000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 193433 | ADATA LEGEND 860 500GB NVME PCIe Gen4x4 - R 5000MB/S W 3000MB/S - SLEG-860-500GCS | 1715000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 183340 | KLEVV SSD CRAS C930 1TB M.2 2280 NVMe PCle Gen4 x4 with Heatsink - K01TBM2SP0-C93 - R7400M | 3700000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 197225 | KLEVV SSD CRAS C925G 1TB M.2 2280 NVMe PCle Gen4 x4 with Heatsink - K01TBM2SP0-25G - R7400 | 3250000 | in_stock | canonical URL, valid JSON shape, empty description accepted |

## Notebook

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 198044 | Acer Nitro V16S ANV16S-41-R8CJ | 18990000 | in_stock | canonical URL, valid JSON shape |
| 198726 | Asus TUF Gaming A15 FA506NCG-R735B6T-HM | 13590000 | in_stock | canonical URL, valid JSON shape |
| 192054 | HP 14-em0018AU/em0019AU | 8620000 | in_stock | canonical URL, valid JSON shape |
| 197319 | Asus TUF Gaming F16 FX608JH-I5N55J6G-HM | 19900000 | in_stock | canonical URL, valid JSON shape |
| 196412 | Lenovo IdeaPad Slim 3 14IRH10-7FID/7GID | 12490000 | in_stock | canonical URL, valid JSON shape |

## LCD

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 194185 | Asus VA259HGA 24.5 FHD IPS 120Hz Gaming Monitor Built-in Speaker | 1285000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 188908 | LG 24 24GS60F-B UltraGear FHD IPS 180Hz Gaming Monitor | 1625000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 186522 | CUBE GAMING RETINA PRO F22V10H 21.5 FHD Frameless 100Hz Gaming Monitor - Response Time 5ms | 890000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 189618 | CUBE GAMING CHAMBER NS27FI 27 FHD IPS Frameless Design 240Hz Gaming Monitor (RGB Light) wi | 2150000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 188547 | Samsung 32 S32CG552 Odyssey G5 QHD 165Hz Curved Gaming Monitor | 3135000 | in_stock | canonical URL, valid JSON shape, empty description accepted |

## Accessories

| SKU | Name | Price IDR | Stock | Notes |
|---|---|---:|---|---|
| 107805 | CUBE GAMING LED Strip Version 2.0 - Magnetic Instalation - 30cm - Red | 45000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 198180 | CUBE GAMING V6 - 6-Port Addressable RGB & PWM Fan Hub with Remote | 90000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 180142 | CUBE GAMING FLEXING Neon Strip | 190000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 107806 | CUBE GAMING LED Strip Version 2.0 - Magnetic Instalation - 30cm - Blue | 45000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
| 107807 | CUBE GAMING LED Strip Version 2.0 - Magnetic Instalation - 30cm - Green | 45000 | in_stock | canonical URL, valid JSON shape, empty description accepted |
