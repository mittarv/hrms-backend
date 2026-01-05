# HRMS Backend

This is the backend application for the HRMS (Human Resource Management System) built with Node.js, Express, TypeScript, and Sequelize.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Node Version](#node-version)
- [Sequelize Supported Databases](#sequelize-supported-databases)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Building the Project](#building-the-project)
- [Database Migration](#database-migration)
- [Running the Application](#running-the-application)
- [Docker Setup](#docker-setup)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Docker** (optional, for containerized deployment)
- **Database** (MySQL or PostgreSQL)

---

## Node Version

This project requires **Node.js version 24** or higher.

You can check your Node.js version by running:
```bash
node --version
```

If you need to install or update Node.js, visit [nodejs.org](https://nodejs.org/).

---

## Sequelize Supported Databases

This project uses **Sequelize ORM** which supports multiple databases. Based on the project dependencies, the following databases are supported:

- **MySQL** (via `mysql2` package) - Currently configured
- **PostgreSQL** (via `pg` package) - Available for use

The database dialect is configured via the `DATABASE_OUTPUT_DIALECT` environment variable. Supported values:
- `mysql` - For MySQL/MariaDB
- `postgres` - For PostgreSQL

---

## Environment Setup

### Step 1: Create .env File

Create a `.env` file in the root directory of the project:

```bash
cp .env.example .env
```

If `.env.example` doesn't exist, create a new `.env` file manually.

### Step 2: Configure Environment Variables

Edit the `.env` file and configure the following environment variables:

#### Application Configuration

```env
# Server Configuration
PORT=5000
NODE_ENV=LOCAL
IP=localhost

# JWT Secret Key (used for authentication tokens)
SECRET_KEY=your-secret-key-here
```

#### Database Configuration

```env
# Output Database Configuration
DATABASE_OUTPUT_HOST=localhost
DATABASE_OUTPUT_PORT=3306
DATABASE_OUTPUT_NAME=your_database_name
DATABASE_OUTPUT_USER=your_database_user
DATABASE_OUTPUT_PASSWORD=your_database_password
DATABASE_OUTPUT_DIALECT=mysql
```

**Note:** 
- For MySQL, use `DATABASE_OUTPUT_DIALECT=mysql`
- For PostgreSQL, use `DATABASE_OUTPUT_DIALECT=postgres`
- Default port for MySQL is `3306`, for PostgreSQL is `5432`

#### Email Configuration (SMTP)

```env
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-email-password

# HRMS Email Settings
HRMS_SMTP_FROM=noreply@mittarv.com
HRMS_DASHBOARD_URL=http://localhost:3000
```

#### Optional Configuration

#### Azure Service Bus Configuration

```env
# Azure Service Bus (for message queuing)
AZURE_SERVICE_BUS_CONNECTION_STRING=your-azure-service-bus-connection-string
AZURE_SERVICE_BUS_QUEUE_NAME=your-queue-name
```

#### Azure Event Hub Configuration

```env
# Azure Event Hub (for event logging)
EVENT_HUB_CONNECTION_STRING=your-event-hub-connection-string
EVENT_HUB_NAME=your-event-hub-name
```

```env
# Logging Configuration (optional, defaults provided)
BATCH_SIZE=1
FLUSH_INTERVAL=30000
SLOW_THRESHOLD=10000
```

### Environment Variables Summary

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `5000` |
| `NODE_ENV` | Yes | Environment (LOCAL, DEVELOPMENT, PRODUCTION) | - |
| `IP` | No | Server IP for Swagger | `localhost` |
| `SECRET_KEY` | Yes | JWT secret key for token signing | - |
| `DATABASE_OUTPUT_HOST` | Yes | Database host address | - |
| `DATABASE_OUTPUT_NAME` | Yes | Database name | - |
| `DATABASE_OUTPUT_USER` | Yes | Database username | - |
| `DATABASE_OUTPUT_PASSWORD` | Yes | Database password | - |
| `DATABASE_OUTPUT_DIALECT` | Yes | Database dialect (mysql/postgres) | - |
| `SMTP_HOST` | Yes | SMTP server host | - |
| `SMTP_PORT` | Yes | SMTP server port | - |
| `SMTP_USER` | Yes | SMTP username | - |
| `SMTP_PASS` | Yes | SMTP password | - |
| `HRMS_SMTP_FROM` | Yes | Email sender address | - |
| `HRMS_DASHBOARD_URL` | Yes | Frontend dashboard URL | - |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | No | Azure Service Bus connection | - |
| `AZURE_SERVICE_BUS_QUEUE_NAME` | No | Azure Service Bus queue name | - |
| `EVENT_HUB_CONNECTION_STRING` | No | Azure Event Hub connection | - |
| `EVENT_HUB_NAME` | No | Azure Event Hub name | - |
| `BATCH_SIZE` | No | Logging batch size | `1` |
| `FLUSH_INTERVAL` | No | Log flush interval (ms) | `30000` |
| `SLOW_THRESHOLD` | No | Slow request threshold (ms) | `10000` |

---

## Installation

Install all project dependencies:

```bash
npm install
```

This will install all required packages listed in `package.json`.

---

## Building the Project

Compile TypeScript files to JavaScript:

```bash
npm run build
```

This command:
- Compiles all TypeScript files (`.ts`) to JavaScript in the `dist/` directory
- Copies the `views/` directory to `dist/views/` for email templates

The build output will be in the `dist/` folder.

---

## Database Migration (Mandatory)

**IMPORTANT:** Database migration is a **required step** before running the application for the first time.

After building the project, you **must** run database migrations for data migration:

```bash
npm run migrate
```

This will run all pending migrations for the configured database.

### Migration Commands

- **Run all migrations:**
  ```bash
  npm run migrate
  ```

- **Run migrations for specific database:**
  ```bash
  npm run migrate:output
  ```

- **Rollback last migration:**
  ```bash
  npm run migrate:rollback
  ```

- **Rollback all migrations:**
  ```bash
  npm run migrate:reset
  ```

**Important:** Always ensure your `.env` file is properly configured with correct database credentials before running migrations.

---

## Running the Application

### Development Mode

Run the application in development mode with hot-reload:

```bash
npm run dev
```

or

```bash
npm run server
```

### Production Mode

1. Build the project first:
   ```bash
   npm run build
   ```

2. Run migrations:
   ```bash
   npm run migrate
   ```

3. Start the server:
   ```bash
   npm start
   ```

The server will start on the port specified in your `.env` file (default: `5000`).

You can access the API at: `http://localhost:5000`

---

## Docker Setup

### Building the Docker Image

Build the Docker image:

```bash
docker build -t hrms-backend .
```

This will:
- Use Node.js 24 Alpine as the base image
- Install dependencies
- Build the TypeScript project
- Create an optimized production image

### Running the Docker Container

Run the container:

```bash
docker run -d \
  --name hrms-backend \
  -p 5050:5050 \
  --env-file .env \
  hrms-backend
```

**Note:** 
- The container exposes port `5050` by default (as defined in Dockerfile)
- Make sure your `.env` file has `PORT=5050` or update the port mapping accordingly
- The `--env-file .env` flag loads all environment variables from your `.env` file

### Docker Compose (Optional)

You can also use Docker Compose. Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  hrms-backend:
    build: .
    container_name: hrms-backend
    ports:
      - "5050:5050"
    env_file:
      - .env
    restart: unless-stopped
    depends_on:
      - db

  db:
    image: mysql:8.0
    container_name: hrms-db
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: your_database_name
      MYSQL_USER: your_database_user
      MYSQL_PASSWORD: your_database_password
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

Then run:

```bash
docker-compose up -d
```

### Important Docker Notes

1. **Database Migrations in Docker:** If running migrations inside the container, you may need to:
   ```bash
   docker exec -it hrms-backend npm run migrate
   ```

2. **Port Configuration:** Ensure your `.env` file has `PORT=5050` to match the Dockerfile's exposed port.

3. **Logs:** View container logs:
   ```bash
   docker logs hrms-backend
   ```

4. **Stop Container:**
   ```bash
   docker stop hrms-backend
   ```

5. **Remove Container:**
   ```bash
   docker rm hrms-backend
   ```

---

## Project Structure

```
hrms-backend/
├── apiLogging/          # API logging utilities
├── associations/        # Sequelize model associations
├── config/             # Configuration files
├── controllers/        # Route controllers
├── cronJobs/           # Scheduled tasks
├── dist/               # Compiled JavaScript (generated)
├── interfaces/         # TypeScript interfaces
├── middlewares/        # Express middlewares
├── migrations/         # Database migration files
├── models/             # Sequelize models
├── routes/             # Express routes
├── utilities/          # Utility functions
├── views/              # Email templates (Handlebars)
├── Dockerfile          # Docker configuration
├── index.ts            # Application entry point
├── migration.js        # Migration runner
└── package.json        # Project dependencies
```


## Troubleshooting

### Common Issues

1. **Database Connection Error:**
   - Verify database credentials in `.env`
   - Ensure database server is running
   - Check if database exists

2. **Migration Errors:**
   - Ensure database is created before running migrations
   - Check database user has proper permissions
   - Verify `DATABASE_OUTPUT_DIALECT` matches your database type

3. **Port Already in Use:**
   - Change `PORT` in `.env` to an available port
   - Or stop the process using the port

4. **Build Errors:**
   - Ensure all TypeScript dependencies are installed
   - Check for TypeScript compilation errors
   - Verify `tsconfig.json` is properly configured

---

## License

ISC

---

## Support

For issues and questions, please visit: [GitHub Issues](https://github.com/mittarv/backend/issues)
