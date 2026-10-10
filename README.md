# Decorative Lighting E-commerce

Full-stack e-commerce application for decorative lighting with Excel SKU control, attribute filtering, and SEO optimization.

## Features

✅ **Excel SKU Control** - Import products via Excel with compulsory/optional attributes validation
✅ **Mapped Images** - Images mapped from repository via Excel column
✅ **Breadcrumbs** - JSON-LD breadcrumb schema for SEO
✅ **Attribute Filters** - Filter by style, material, color temperature, brand, etc.
✅ **Price Filters** - Price range slider
✅ **SEO Compatible** - Metadata API, JSON-LD structured data, sitemap generation
✅ **Hostinger Ready** - Deployable on Hostinger Node.js + PostgreSQL

## Tech Stack

**Frontend:** Next.js 14, React 18, Tailwind CSS
**Backend:** Node.js, Express
**Database:** PostgreSQL with JSONB for flexible attributes
**Storage:** Local uploads (can be replaced with S3)

## Quick Start

```bash
# 1. Database
psql -c "CREATE DATABASE lighting_db;"
psql lighting_db < docs/schema.sql

# 2. Backend
cd backend
npm install
cp .env.example .env
npm run dev

# 3. Frontend
cd frontend
npm install
npm run dev

# 4. Import Excel
curl -X POST -F "file=@docs/excel-template.csv" http://localhost:3000/api/excel-import/import-excel
```

## Project Structure

```
decorative-lighting-ecommerce/
├── backend/
│   ├── api/           # API endpoints
│   ├── db/            # Database queries
│   ├── validators/    # Excel validation
│   └── server.js
├── frontend/
│   ├── app/           # Next.js pages
│   ├── components/    # React components
│   ├── lib/           # API client
│   └── package.json
└── docs/
    ├── SETUP.md       # Detailed setup
    ├── schema.sql     # Database schema
    └── excel-template.csv
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/products` | Get all products |
| `/api/products/:sku` | Get product by SKU |
| `/api/search/products` | Search with filters |
| `/api/categories` | Read category tree and manage category hierarchy |
| `/api/excel-import/import-excel` | Import Excel |
| `/api/upload/image` | Upload image |
| `/api/seo/sitemap` | Generate sitemap |

## Excel Template

See `docs/excel-template.csv` for required columns.

**Compulsory:** sku, name, price, category, wattage, lumens, color_temperature, material, style, image_repo_path

**Optional:** brand, ip_rating, voltage, beam_angle, mounting_type, smart_compatible, warranty



