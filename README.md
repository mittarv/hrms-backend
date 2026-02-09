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
- [CI/CD Setup](#cicd-setup)
  - [GitHub Actions Workflow](#github-actions-workflow)
  - [Setting Up GitHub Secrets](#setting-up-github-secrets)
  - [Setting Up GitHub Variables](#setting-up-github-variables)
  - [Setting Up Environment](#setting-up-environment)
  - [Deployment Process](#deployment-process)

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Docker** (optional, for containerized deployment)
- **Database** (MySQL or PostgreSQL)
- **Orm** (sequelize)

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

SMTP (Simple Mail Transfer Protocol) configuration is **required** for sending HRMS-related emails. This includes:
- Leave request notifications and approvals/rejections
- Employee onboarding welcome emails
- Password reset emails
- Attendance and timesheet notifications
- Holiday announcements
- Other HR communication emails

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

**Note:** If using Gmail, you may need to enable "Less secure app access" or use an App Password for `SMTP_PASS`.

#### Optional Configuration

#### Azure Service Bus Configuration

Azure Service Bus is used for **asynchronous message queuing** between microservices. This enables:
- Decoupled communication between services
- Reliable message delivery with retry mechanisms
- Background job processing
- Event-driven architecture support

```env
# Azure Service Bus (for message queuing)
AZURE_SERVICE_BUS_CONNECTION_STRING=your-azure-service-bus-connection-string
AZURE_SERVICE_BUS_QUEUE_NAME=your-queue-name
```

**Note:** Azure Service Bus is optional. If not configured, the application will work without message queuing capabilities.

#### Azure Event Hub Configuration

Azure Event Hub is used for **centralized event logging and analytics**. This enables:
- Real-time API request/response logging
- Application performance monitoring
- User activity tracking and auditing
- Centralized log aggregation for analysis
- Integration with Azure Monitor and other analytics tools

```env
# Azure Event Hub (for event logging)
EVENT_HUB_CONNECTION_STRING=your-event-hub-connection-string
EVENT_HUB_NAME=your-event-hub-name
```

**Note:** Azure Event Hub is optional. If not configured, the application will still log locally but without centralized event streaming.

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

## Initialize Database Tables

Before building the project, run the development server once to automatically create all required database tables:

```bash
npm run dev
```

This command:
- Connects to the configured database
- Automatically creates all required tables defined in Sequelize models
- Syncs the database schema with the application models
- Starts the development server with hot-reload

**Note:** You can stop the server (Ctrl+C) after the tables are created, then proceed to build and migrate.

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

## Setting Up Superadmin (First-Time Setup)

**IMPORTANT:** Before onboarding any employees or accessing the HRMS features, you need to set up a superadmin user.

After the database tables are created and the application is running, manually update the `tmsusers` table to grant superadmin privileges to the first user:

### Using MySQL:

```sql
UPDATE tmsusers SET usertype = 900 WHERE id = <your_user_id>;
```

### Using PostgreSQL:

```sql
UPDATE tmsusers SET usertype = 900 WHERE id = <your_user_id>;
```

**User Type Values:**
- `900` - Superadmin (full system access, can onboard employees and manage all HRMS features)

**Why is this needed?**
- The superadmin role allows you to onboard the first set of employees
- Without a superadmin, you cannot access HRMS administrative features
- This is a one-time setup required during initial deployment

**Note:** Replace `<your_user_id>` with the actual user ID from the `tmsusers` table.

---

## Docker Setup

This project includes Docker support for containerized deployment.

### Prerequisites

- Docker installed on your system
- Docker Compose (optional, but recommended)

### Using Docker Compose (Recommended)

The project includes a `docker-compose.yml` file for easy deployment:

```bash
# Build and start the container
docker compose up -d --build hrms-backend

# View logs
docker compose logs -f hrms-backend

# Stop the container
docker compose down
```

### Docker Compose Configuration

The `docker-compose.yml` includes:

```yaml
services:
  hrms-backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: hrms-backend:latest
    container_name: hrms-backend
    ports:
      - "${HOST_PORT:-5000}:${PORT:-5000}"
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=${PORT:-5000}
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:${PORT:-5000}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Manual Docker Commands

If you prefer not to use Docker Compose:

```bash
# Build the image
docker build -t hrms-backend:latest .

# Run the container
docker run -d \
  --name hrms-backend \
  -p 5000:5000 \
  --env-file .env \
  hrms-backend:latest

# View logs
docker logs -f hrms-backend

# Stop and remove container
docker stop hrms-backend && docker rm hrms-backend
```

### Environment Variables in Docker

Make sure your `.env` file is configured before running Docker:

- `PORT` - Application port (default: 5000)
- `HOST_PORT` - Docker host port mapping (default: 5000)
- All other environment variables from [Environment Setup](#environment-setup)

### Database Migrations in Docker

Run migrations inside the container:

```bash
docker exec -it hrms-backend npm run migrate
```

---

## CI/CD Setup

This project uses **GitHub Actions** for automated deployment to a self-hosted Docker environment.

### GitHub Actions Workflow

The workflow automatically:
1. Creates release tags based on date and commit SHA (format: `release-YYYY-MM-DD-<sha>`)
2. Generates `.env` file from GitHub Secrets and Variables
3. Builds and deploys the Docker container
4. Creates a GitHub Release with auto-generated release notes
5. Provides deployment summary

**Workflow file:** [`.github/workflows/deploy-docker.yml`](.github/workflows/deploy-docker.yml)

### Setting Up GitHub Secrets

Navigate to: **Repository Settings → Secrets and variables → Actions → Secrets → New repository secret**

Add the following **sensitive** secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SECRET_KEY` | JWT secret key for authentication | `your-super-secret-jwt-key-here` |
| `REFRESH_TOKEN_SECRET` | Refresh token secret key | `your-refresh-token-secret-here` |
| `SMTP_PASS` | SMTP email password | `your-email-app-password` |
| `DATABASE_OUTPUT_PASSWORD` | Database password | `your-db-password` |
| `EVENT_HUB_CONNECTION_STRING` | Azure Event Hub connection string | `Endpoint=sb://...` |
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | Azure Service Bus connection string | `Endpoint=sb://...` |

### Setting Up GitHub Variables

Navigate to: **Repository Settings → Secrets and variables → Actions → Variables → New repository variable**

Add the following **public configuration** variables:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Node environment | `production` |
| `IP` | Server IP address | `0.0.0.0` |
| `SMTP_HOST` | SMTP host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username/email | `your-email@gmail.com` |
| `HRMS_SMTP_FROM` | HRMS email from address | `noreply@mittarv.com` |
| `HRMS_DASHBOARD_URL` | HRMS dashboard URL | `https://hrms.mittarv.com` |
| `EVENT_HUB_NAME` | Azure Event Hub name | `your-event-hub-name` |
| `AZURE_SERVICE_BUS_QUEUE_NAME` | Azure Service Bus queue name | `your-queue-name` |
| `DATABASE_OUTPUT_NAME` | Database name | `hrms_database` |
| `DATABASE_OUTPUT_USER` | Database username | `hrms_user` |
| `DATABASE_OUTPUT_PORT` | Database port | `3306` |
| `DATABASE_OUTPUT_HOST` | Database host address | `localhost` or `db-server.example.com` |
| `DATABASE_OUTPUT_DIALECT` | Database dialect | `mysql` or `postgres` |
| `CRON_JOB_MACHINE_HOSTNAME` | Cron job machine hostname | `hrms-server-01` |
| `HOST_PORT` | Docker host port | `5000` |

**Optional Variables** (with defaults):

| Variable Name | Description | Default |
|---------------|-------------|---------|
| `BATCH_SIZE` | Batch size for logging | `1` |
| `FLUSH_INTERVAL` | Flush interval for logging (ms) | `30000` |
| `SLOW_THRESHOLD` | Slow threshold for logging (ms) | `10000` |

### Setting Up Environment

1. Navigate to: **Repository Settings → Environments → New environment**
2. Create environment named: `hrms-backend`
3. (Optional) Add environment protection rules:
   - Required reviewers
   - Wait timer
   - Deployment branches

### Self-Hosted Runner Setup

The workflow requires a self-hosted runner:

1. Navigate to: **Repository Settings → Actions → Runners → New self-hosted runner**
2. Follow instructions to install runner on your server
3. Ensure the runner has:
   - Docker and Docker Compose installed
   - Access to database server
   - Proper network configuration

### Deployment Process

**Automated Deployment** (on push to main):

```bash
# The workflow triggers automatically when you push to main
git push origin main
```

**Manual Deployment**:

1. Go to: **Actions → Build, Deploy to Docker and Create Release → Run workflow**
2. Select branch: `main`
3. Click **Run workflow**

**Deployment Flow:**

1. Workflow checks out code
2. Generates release tag (e.g., `release-2026-01-24-abc1234`)
3. Creates `.env` from GitHub secrets/variables
4. Stops existing container
5. Builds new Docker image
6. Starts new container
7. Verifies container health
8. Creates GitHub Release with auto-generated notes
9. Cleans up `.env` file

**Viewing Deployment:**

- **GitHub Actions:** Check workflow runs in the **Actions** tab
- **Releases:** View created releases in the **Releases** section
- **Logs:** Check deployment summary in workflow run details

### Release Versioning

Instead of semantic versioning, this project uses **commit-based versioning**:

- **Format:** `release-YYYY-MM-DD-<short-sha>`
- **Example:** `release-2026-01-24-abc1234`
- **Benefits:**
  - No merge conflicts
  - Unique tags per deployment
  - Easy to track deployment date and commit

### Troubleshooting CI/CD

### Troubleshooting CI/CD

**Workflow fails to start:**
- Check if self-hosted runner is online
- Verify environment `hrms-backend` exists
- Check repository permissions

**Container fails to start:**
- Verify all required secrets are set
- Check Docker logs: `docker logs hrms-backend`
- Verify database connectivity

**Database connection errors:**
- Ensure database host is accessible from runner
- Verify database credentials in GitHub secrets/variables
- Check if database exists

**Permission errors:**
- Ensure runner user has Docker permissions
- Check file system permissions

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

MIT

---

## Support

For questions, email us at: [support@mittarv.com](mailto:support@mittarv.com)
