# Distribution Metrics Backend

Backend server for Distribution Report with PostgreSQL database and Express API. Provides comprehensive metrics for sales distribution analysis including revenue, outlets, productivity, and universe data.

## Tech Stack

- **Node.js** with Express.js
- **PostgreSQL** Database
- **Sequelize ORM** with dynamic model generation
- **CORS** enabled for frontend integration

## Setup

### Option 1: Docker Setup (Recommended)

The easiest way to run the application is using Docker. This will set up both the Node.js backend and PostgreSQL database automatically.

**Prerequisites:**
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

**Steps:**

1. **Clone the repository and navigate to the project directory**

2. **Configure environment variables** (optional):
   - The docker-compose.yml uses sensible defaults
   - To customize, copy `.env.docker` to `.env.docker.local` and modify as needed

3. **Start the application:**
```bash
# Start all services (backend + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

4. **Verify the application is running:**
- Backend API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- Database: `localhost:5432`

**Docker Commands:**
```bash
# Rebuild the backend image after code changes
docker-compose build backend

# Restart a specific service
docker-compose restart backend

# View service status
docker-compose ps

# Execute commands in the backend container
docker-compose exec backend npm run generate-models

# Access PostgreSQL database
docker-compose exec postgres psql -U reactdevelopment -d reactdev_db
```

---

### Option 2: Local Setup (Without Docker)

If you prefer to run the application locally without Docker:

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables** - Create a `.env` file:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
PORT=3000
NODE_ENV=development
```

3. **Ensure PostgreSQL is running locally** with the credentials specified in `.env`

4. **Generate models from database:**
```bash
npm run generate-models
```

5. **Start the server:**
```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev
```

6. **Verify server is running:**
- Server URL: `http://localhost:3000`
- Health check: `http://localhost:3000/health`

## API Endpoints

### General Endpoints

#### Health Check
```
GET /health
```
Returns server health status and environment information.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-29T10:00:00.000Z",
  "environment": "development"
}
```

---

### Summary Endpoints

#### Get Summary Data
```
GET /api/summary
```
Returns summary of gross amount and customer count by data flag.

**Query Parameters:**
- `startDate` (optional): Start date for filtering (default: '2025-11-01')
- `endDate` (optional): End date for filtering (default: '2025-11-25')

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "dataFlag": "Primary Sales",
      "grossAmount": "1234567",
      "customerCount": 456
    }
  ]
}
```

---

### Revenue Endpoints

#### Get Total Revenue
```
GET /api/revenue/total
```
Returns total gross amount by data flag.

**Query Parameters:**
- `startDate` (optional): Start date (default: '2025-11-01')
- `endDate` (optional): End date (default: '2025-11-25')

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "dataFlag": "Primary Sales",
      "grossAmount": "1234567"
    }
  ]
}
```

---

### Universe Endpoints

#### Get Universe Data
```
GET /api/universe
```
Returns count of distinct customers by data flag.

**Query Parameters:**
- `startDate` (optional): Start date (default: '2025-07-01')
- `endDate` (optional): End date (default: '2025-11-25')

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "dataFlag": "Primary Sales",
      "customerCount": "789"
    }
  ]
}
```

---

### Outlet/Times Endpoints

#### Get Times-Outlets Summary
```
GET /api/times/summary
```
Returns outlet purchase frequency distribution (1, 2, 3, or 4+ purchases per month).

**Query Parameters:**
- `startDate` (optional): Start date (default: '2025-11-01')
- `endDate` (optional): End date (default: '2025-11-25')

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "dataFlag": "Primary Sales",
      "4": 123,
      "3": 45,
      "2": 67,
      "1": 89
    }
  ]
}
```

#### Get Outlets with 4+ Purchases
```
GET /api/times/count/4
```
Returns count of outlets with 4 or more purchases per month.

#### Get Outlets with 3 Purchases
```
GET /api/times/count/3
```
Returns count of outlets with exactly 3 purchases per month.

#### Get Outlets with 2 Purchases
```
GET /api/times/count/2
```
Returns count of outlets with exactly 2 purchases per month.

#### Get Outlets with 1 Purchase
```
GET /api/times/count/1
```
Returns count of outlets with exactly 1 purchase per month.

**All count endpoints accept:**
- Query Parameters: `startDate`, `endDate`
- Response format similar to summary endpoint

---

### Productivity Endpoints

#### Get Productive Outlets
```
GET /api/productivity/productive-outlets
```
Returns count of distinct productive outlets by data flag.

**Query Parameters:**
- `startDate` (optional): Start date (default: '2025-07-01')
- `endDate` (optional): End date (default: '2025-11-25')

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "dataFlag": "Primary Sales",
      "outletCount": "456"
    }
  ]
}
```

#### Get Top SKU Productivity (Class A)
```
GET /api/productivity/top-sku-a
```
Returns productivity metrics for Class A SKUs with document counts by month, brand, and therapeutic category.

**Query Parameters:**
- `startDate` (optional): Start date (default: '2025-09-01')
- `endDate` (optional): End date (default: '2025-11-25')

**Response:**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "month_": "2025-11-01T00:00:00.000Z",
      "item_description": "Product Name",
      "grp_brand": "Brand Name",
      "catg_theraptic": "Category",
      "doc_cnt": "123"
    }
  ]
}
```

---

### Filter Endpoints

#### Get Business Lines
```
GET /api/business-lines
```
Returns all unique business lines.

**Response:**
```json
{
  "count": 5,
  "businessLines": [
    {
      "businessLineId": "P07",
      "businessLineDescription": "Business Line 1"
    }
  ]
}
```

#### Get Products
```
GET /api/products?businessLineId=P07
```
Returns all products for a specific business line.

**Query Parameters (Required):**
- `businessLineId`: Business line ID

**Response:**
```json
{
  "count": 50,
  "products": [
    {
      "itemCode": "12345",
      "itemDescription": "Product Name"
    }
  ]
}
```

#### Get Locations
```
GET /api/locations?businessLineId=P07
```
Returns all locations for a specific business line.

**Query Parameters (Required):**
- `businessLineId`: Business line ID

**Response:**
```json
{
  "count": 20,
  "locations": [
    {
      "branchId": "B001",
      "branchDescription": "Branch Name"
    }
  ]
}
```

#### Get Regional Distributors
```
GET /api/regional-distributors?businessLineId=P07
```
Returns all regional distributors for a specific business line.

**Query Parameters (Required):**
- `businessLineId`: Business line ID

**Response:**
```json
{
  "count": 15,
  "distributors": [
    {
      "distributorCode": "D001",
      "distributorDescription": "Distributor Name"
    }
  ]
}
```

---

### Database Utility Endpoints

#### List Available Tables
```
GET /api
```
Returns all available database tables and models.

**Response:**
```json
{
  "message": "Available tables",
  "models": ["PrimarySecondarySalesDatum"],
  "tables": [
    {
      "modelName": "PrimarySecondarySalesDatum",
      "tableName": "primary_secondary_sales_data"
    }
  ],
  "usage": "GET /api/:tableName?limit=100&offset=0"
}
```

#### Get Table Data
```
GET /api/:tableName?limit=1000&offset=0
```
Returns paginated data from any table.

**Path Parameters:**
- `tableName`: Name of the table or model

**Query Parameters:**
- `limit` (optional): Number of records (default: 1000)
- `offset` (optional): Offset for pagination (default: 0)

#### Get Indexes for a Table
```
GET /api/indexes/:tableName?schemaName=primary_secondary_sales_schm
```
Returns all indexes for a specific table.

**Path Parameters:**
- `tableName`: Name of the table

**Query Parameters:**
- `schemaName` (optional): Schema name (default: 'primary_secondary_sales_schm')

#### Get All Indexes in Schema
```
GET /api/indexes?schemaName=primary_secondary_sales_schm
```
Returns all indexes in the specified schema.

**Query Parameters:**
- `schemaName` (optional): Schema name (default: 'primary_secondary_sales_schm')

---

## Common Filters

All metric endpoints automatically apply these filters:
- Business Line IDs: `P07`, `P08`, `P12`
- Excludes Primary Sales with channel "Distributor - A"
- Includes only records with reason code "Sales"

## Error Handling

All endpoints return errors in the following format:
```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing required parameters)
- `404` - Not Found (table/resource doesn't exist)
- `500` - Internal Server Error

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run generate-models` - Generate Sequelize models from database

### Project Structure

```
distribution-metrics-be/
├── server.js           # Main server file
├── config/
│   ├── config.js       # Configuration management
│   └── database.js     # Database connection
├── models/             # Sequelize models (auto-generated)
├── routes/             # API route handlers
│   ├── api.js          # Main API router
│   ├── routes.revenue.js
│   ├── routes.universe.js
│   ├── routes.outlets.js
│   ├── routes.summary.js
│   ├── routes.productivity.js
│   └── shared.js       # Shared utilities
└── scripts/
    └── generate-models.js  # Model generation script
```

## Notes

- All date parameters accept format: `YYYY-MM-DD`
- All endpoints support CORS for frontend integration
- Database schema: `primary_secondary_sales_schm`
- Models are dynamically generated based on database structure
