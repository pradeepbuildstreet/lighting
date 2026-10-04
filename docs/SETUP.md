# Decorative Lighting E-commerce - Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Python 3.10+ (for zip creation)

## Project Structure

```
decorative-lighting-ecommerce/
├── backend/          # Node.js + Express API
├── frontend/         # Next.js 14 application
└── docs/            # Documentation
```

## Quick Start

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb lighting_db

# Run schema (see docs/schema.sql)
psql lighting_db < docs/schema.sql
psql -U postgres -h localhost -p 5432 -d lighting_db -f .\docs\schema.sql (for windows)
```

For an existing database, apply the migrations in order. The first two create the category hierarchy; the third adds anonymous wishlist and enquiry storage:

```powershell
psql -U postgres -h localhost -p 5432 -d lighting_db -f .\docs\migrations\001_category_hierarchy.sql
psql -U postgres -h localhost -p 5432 -d lighting_db -f .\docs\migrations\002_false_ceiling_subcategory.sql
psql -U postgres -h localhost -p 5432 -d lighting_db -f .\docs\migrations\003_wishlist_enquiries.sql
psql -U postgres -h localhost -p 5432 -d lighting_db -f .\docs\migrations\004_wishlist_analytics_index.sql
```

Wishlist enquiries are submitted without login or OTP. Customer contact details are stored only after explicit submission. Configure `NEXT_PUBLIC_MANAGER_WHATSAPP_NUMBER` as the manager's country-code-plus-number digits (India example: `918124969000`). The customer opens WhatsApp with the private enquiry link and details prefilled, then presses Send.

The manager is available at `/admin/enquiries` and `/admin/categories`. This repository does not provide application-level authentication, so deployment access controls must protect those pages and restrict write methods on `/api/categories` and `/api/wishlists/admin`.

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://user:password@localhost:5432/lighting_db

# Start server
npm run dev
```

Backend runs on: http://localhost:3000

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
cp .env.local .env.local

# Set the canonical public origin before building or deploying
NEXT_PUBLIC_API_URL=https://api.your-domain.example/api
NEXT_PUBLIC_SITE_URL=https://your-domain.example

# Start development server
npm run dev
```

Frontend runs on: http://localhost:3001

### 4. Import Products from Excel

```bash
# Use the template: docs/excel-template.xlsx
# POST to: http://localhost:3000/api/excel-import/import-excel

curl -X POST   -F "file=@excel-template.xlsx"   http://localhost:3000/api/excel-import/import-excel
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/products` | Get all products |
| `/api/products/:sku` | Get product by SKU |
| `/api/search/products` | Search with filters |
| `/api/search/filters/options` | Get filter options |
| `/api/excel-import/import-excel` | Import Excel |
| `/api/upload/image` | Upload image |
| `/api/upload/document` | Upload document |
| `/api/upload/video` | Upload video |
| `/api/seo/products` | Get SEO data |
| `/api/seo/sitemap` | Generate sitemap |

## Excel Template Format

**Compulsory Columns:**
- `sku` - Product SKU (e.g., DL-001)
- `name` - Product name
- `price` - Price in INR
- `category` - Category slug (ceiling, pendant, wall, etc.)
- `wattage` - Power in watts
- `lumens` - Light output
- `color_temperature` - Kelvin (2700, 3000, 4000, 6000)
- `material` - brass, iron, wood, glass
- `style` - modern, vintage, industrial
- `image_repo_path` - Path to image (e.g., uploads/dl001.jpg)

**Optional Columns:**
- `brand`, `ip_rating`, `voltage`, `beam_angle`
- `mounting_type`, `smart_compatible`, `warranty`
- `description`, `document_urls`, `video_urls`

## Hostinger Deployment

### Backend (Node.js)
1. Upload `backend/` to Hostinger Node.js app
2. Set environment variables in Hostinger dashboard
3. Configure PostgreSQL (or use Supabase)

### Frontend (Next.js)
1. Build: `npm run build`
2. Upload `frontend/.next/` to Hostinger
3. Set `NEXT_PUBLIC_API_URL` to backend URL

### Database Options
- **Option 1**: Hostinger MySQL (modify schema for MySQL)
- **Option 2**: Supabase (free PostgreSQL)
- **Option 3**: AWS RDS

## Troubleshooting

```bash
# Backend not starting?
cd backend
npm install
node server.js

# Frontend not starting?
cd frontend
npm install
npm run dev

# Database connection error?
# Check DATABASE_URL in .env

# Excel import fails?
# Ensure compulsory columns exist in Excel
```

