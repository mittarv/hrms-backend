<div align="center">
  <img src="https://mittarvtesting.blob.core.windows.net/mittarv-icons/mittarv-logo-horizontal-coloured.png" alt="MittArv HRMS" width="280" />

  <h1>MittArv HRMS</h1>
  <h3>Backend</h3>

  <p>
    An open-source Human Resource Management System for organizations that need
    employee records, leave, attendance, payroll, and access control — without
    locking themselves into a vendor.
  </p>

  <p>
    <a href="https://github.com/mittarv/hrms-backend/stargazers"><img src="https://img.shields.io/github/stars/mittarv/hrms-backend?style=flat&color=ffb400" alt="Stars" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License: AGPL-3.0" /></a>
    <a href="https://github.com/mittarv/hrms-backend/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22+-339933.svg" alt="Node.js 22+" /></a>
    <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-5-000000.svg" alt="Express 5" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg" alt="TypeScript" /></a>
  </p>

  <p>
    <a href="https://hrms.dev.mittarv.com">Live SaaS</a>
    ·
    <a href="https://github.com/mittarv/hrms-frontend">Frontend</a>
    ·
    <a href="#-getting-started">Getting started</a>
    ·
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

## Why MittArv HRMS

Most HR tools are either rigid enterprise suites or spreadsheets pretending to be software. MittArv HRMS is built as a **modular, self-hostable product**: you run it, you own the data, and you can change the modules that matter to you.

This repository is the **HTTP API**. The web app lives in [`hrms-frontend`](https://github.com/mittarv/hrms-frontend).

> The previous codebase is preserved on [`old-code`](https://github.com/mittarv/hrms-backend/tree/old-code). `main` is a from-scratch rewrite with a cleaner module layout.

## Try it

| Path | What you get |
| --- | --- |
| [SaaS demo](https://hrms.dev.mittarv.com) | Hosted product, no install |
| Self-host (this repo) | Full source, local or your own servers |

## Features

<p align="center">
  <img src="https://mittarvtesting.blob.core.windows.net/mittarv-icons/mittarv-icons/Dashboard%20-%204.png" alt="Dashboard" width="800" />
</p>

### People

- **Dashboard** — leaves, birthdays, work anniversaries, and org updates in one view
- **Employee directory** — grid and card views, job history, contacts, salary records
- **Onboarding & offboarding** — hire workflows plus HR and finance clearance

<p align="center">
  <img src="https://mittarvtesting.blob.core.windows.net/mittarv-icons/mittarv-icons/employee_directory.png" alt="Employee directory" width="800" />
</p>

### Time and pay

- **Leave & attendance** — configurable leave types, balances, holidays, and calendars
- **Payroll** — salary components, monthly runs, adjustments, and payslips
- **Requests** — a single inbox for leave, profile edits, extra work, and location changes

<p align="center">
  <img src="https://mittarvtesting.blob.core.windows.net/mittarv-icons/mittarv-icons/leave&attendence.png" alt="Leave and attendance" width="800" />
</p>

### Culture and control

- **Rewards & recognition** — nominations, voting, winners, and payroll hooks
- **Policies & links** — company knowledge that employees can actually find
- **RBAC** — roles and permissions, including sensitive fields such as salary
- **Multi-org** — more than one company or branch on a single deployment

<p align="center">
  <img src="https://mittarvtesting.blob.core.windows.net/mittarv-icons/mittarv-icons/reward&recogination.png" alt="Rewards and recognition" width="800" />
</p>

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0284c7', 'primaryTextColor': '#fff', 'primaryBorderColor': '#0369a1', 'lineColor': '#f43f5e', 'secondaryColor': '#10b981', 'tertiaryColor': '#f59e0b'}}}%%
graph LR
  classDef frontend fill:#3b82f6,stroke:#1d4ed8,stroke-width:4px,color:#fff;
  classDef backend fill:#10b981,stroke:#047857,stroke-width:4px,color:#fff;
  classDef db fill:#f59e0b,stroke:#b45309,stroke-width:4px,color:#fff;

  A[React + TypeScript]:::frontend ==>|REST API| B(Express API):::backend
  B ==>|Prisma| C[(PostgreSQL)]:::db
  linkStyle default stroke-width:4px;
```

| Layer | Stack |
| --- | --- |
| UI | React 19, TypeScript, Vite |
| API | Node.js, Express, TypeScript |
| Data | PostgreSQL (Prisma) |

Each domain lives in `src/modules/` (`identity`, `employees`, `leave`, `payroll`, …). Modules talk through services or events, not by reaching into another module’s database layer.

## Getting started

**Requirements:** [Node.js](https://nodejs.org/) 22+ and npm 10+. PostgreSQL 16+ is required once persistence is wired.

```bash
git clone https://github.com/mittarv/hrms-backend.git
cd hrms-backend
cp .env.example .env
npm install
npm run dev
```

The API listens on [http://localhost:5000](http://localhost:5000).

On macOS, AirPlay Receiver often binds port `5000`. Turn it off in **System Settings → General → AirDrop & Handoff**, or set `PORT=5001` in `.env`.

### Environment

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hrms
```

Copy `.env.example` — never commit `.env`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled production build |

### Health check

```bash
curl http://localhost:5000/health
# {"status":"ok","service":"hrms-backend"}
```

## Project structure

```text
hrms-backend/
├── prisma/              # Schema and migrations
├── src/
│   ├── config/          # Environment and app config
│   ├── jobs/            # Scheduled work
│   ├── lib/             # Shared utilities
│   ├── middleware/      # Auth, tenant, validation
│   ├── modules/         # Feature modules
│   └── main.ts
├── tests/
├── .env.example
└── package.json
```

## Contributing

This project is open source and PRs are welcome.

1. Fork the repo and create a branch from `main`
2. Keep a change inside one module when you can
3. Run `npm run build`
4. Open a pull request that explains **why** the change exists

Found a bug or want a feature? [Open an issue](https://github.com/mittarv/hrms-backend/issues).

## Security

Do not file security issues in public GitHub issues. Email [support@mittarv.com](mailto:support@mittarv.com).

## License

[GNU Affero General Public License v3.0 or later](LICENSE).

You can self-host and modify MittArv HRMS. If you run a modified version as a network service, the AGPL requires you to share those changes with your users.

## Support

- Issues: [github.com/mittarv/hrms-backend/issues](https://github.com/mittarv/hrms-backend/issues)
- Email: [support@mittarv.com](mailto:support@mittarv.com)
- Web app: [github.com/mittarv/hrms-frontend](https://github.com/mittarv/hrms-frontend)
