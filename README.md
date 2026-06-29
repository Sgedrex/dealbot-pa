# 🛒 DealBot PA — Comparador de precios de supermercados de Panamá

Sistema de monitoreo y comparación de precios de abarrotes entre supermercados de Panamá. Scrapea varias tiendas, empareja productos por **código de barras (EAN)**, detecta caídas de precio y avisa por Telegram.

🌐 **Dashboard en vivo:** https://dealbot-atun.vercel.app

---

## ✨ Funciones

- **Comparador retail** — el mismo producto (por EAN) lado a lado en las tiendas, con la más barata y el % de ahorro.
- **Catálogo** y **Mayoristas** — listas separadas (los packs mayoristas no se mezclan con unidades).
- **Filtros** — por categoría, marca, presentación (en agua / aceite / tomate / picante…) y buscador por nombre o SKU.
- **🏆 Ranking de tiendas** — qué tienda es más barata en promedio por categoría.
- **🧺 Canasta básica** — armas una lista y te dice dónde sale más barato comprar todo junto.
- **📈 Histórico** — evolución del precio de cada producto por tienda.
- **📉 Índice de precios** — promedio de la categoría en el tiempo.
- **🔔 Alertas Telegram** — avisa cuando un precio cae.
- **📥 Export** — Excel y PDF de la vista actual.
- **🔄 Actualización** — manual (botón) o automática (cron 2×/día).

## 🏪 Tiendas integradas

| Tienda | Plataforma | Vía |
|---|---|---|
| Super99 | Adobe Commerce Live Search | `catalog-service.adobe.io` |
| SuperXtra | VTEX | API pública de catálogo |
| Super Rey | Instaleap (GraphQL) | `nextgentheadless.instaleap.io` |
| SuperCarnes | Magento Luma | scraping HTML |
| Super Barú | Shopify | `search/suggest.json` |
| MsMega (mayorista) | catálogo PHP | scraping HTML |

## 🧱 Arquitectura

```
pg_cron (2×/día) ─▶ Edge Function "dealbot-scan" (Deno/TS en Supabase)
                       ├─ scrapea las 6 tiendas
                       ├─ guarda precios (histórico) en Postgres
                       ├─ detecta caídas → Telegram
                       └─ vistas SQL: comparador, ranking, histórico, inflación
                              │
   Dashboard (HTML + supabase-js + Chart.js, en Vercel) ◀── lee las vistas (anon key)
```

- **Frontend:** `index.html` — un solo archivo (HTML + JS + Chart.js + SheetJS + jsPDF). Hosteado en Vercel.
- **Backend:** Supabase (Postgres + Edge Function + pg_cron). Emparejamiento por EAN; clasificación mayorista/retail; exclusiones manuales para EAN mal asignados por las tiendas.
- **Notificaciones:** bot de Telegram.

## 📂 Estructura

```
index.html                              # dashboard completo (front)
supabase/functions/dealbot-scan/        # edge function (scraping + alertas)
```

> El esquema SQL (tablas `dealbot_*`, vistas y funciones) vive en el proyecto Supabase.

## ⚠️ Notas

- La **anon key** de Supabase en `index.html` es pública por diseño (solo lee vistas; RLS protege las tablas).
- El **token de Telegram** y la **service_role** viven solo en la Edge Function / variables de entorno de Supabase — no subir a un repo público.
