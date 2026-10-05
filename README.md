# GitLite

GitLite is a Java version-control engine with a Next.js application for user
accounts, isolated repositories, file browsing, staging, commits, and branches.
Repository metadata and account data are stored in MongoDB; repository files
and snapshots are stored on the filesystem.

## Implemented features

- MongoDB-backed registration and sign-in with bcrypt password hashes and
  signed, HTTP-only sessions. Registration requires a separate sign-in.
- Owner-scoped repository list/create/read APIs and repository workspace routes.
- Separate filesystem roots for each account's repositories. API access checks
  repository ownership before reading or changing repository contents.
- Java CLI operations for initialization, status, staging files under `working/`,
  commits, branches, branch switching, and commit checkout.
- Nested staged files and same-named files in different directories are kept
  distinct in snapshots.
- Checkout refuses to overwrite staged, modified, or untracked working files.
- Java integration tests run in temporary directories, and CI checks Java tests,
  TypeScript, and the production frontend build.

The workspace is deliberately limited to implemented operations; it does not
claim to provide hosted remotes, pull requests, issue tracking, CI workflows,
or AI features.

---

## 🚀 Quick Start

### 1. Run the Next.js Frontend
Configure MongoDB Atlas first. Copy `frontend/.env.example` to `frontend/.env.local`, set `MONGODB_URI`, `MONGODB_DB`, and a private `AUTH_SECRET` of at least 32 characters. See [frontend/README.md](./frontend/README.md) for Atlas network access, secret generation, and deployment details.

Then double-click `start-frontend.bat` or run:

```bash
cd frontend
npm install
npm run dev
```

The npm lifecycle compiles the Java engine into `frontend/.gitlite-classes`
before development, production builds, and production starts. Java 21 and Node
20 or newer are required. The development server and production build use
separate Next.js output directories, so running a production build will not
replace chunks used by the dev server.

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 2. Run GitLite from the Command Line
Use the included `gitlite.bat` wrapper from the root directory:

```bash
# Check status
.\gitlite.bat status

# Stage a file
.\gitlite.bat add working/notes.txt

# Create a commit
.\gitlite.bat commit "feat: your commit message"

# View commit history
.\gitlite.bat log

# List branches
.\gitlite.bat branches

# Create and switch branches
.\gitlite.bat branch feature-new
.\gitlite.bat switch feature-new

# Checkout a previous commit
.\gitlite.bat checkout <commit-id>
```

---

## 📁 Repository Structure

```
GitLite/
├── .gitlite-data/             # Ignored per-user repository data (created at runtime)
├── .gitlite/                  # Local CLI repository metadata (if initialized)
│   ├── HEAD                   # Current active branch pointer
│   ├── branches/              # Branch reference files (.txt)
│   ├── commits/               # Commit snapshots and metadata.txt
│   ├── staging/               # Staged files ready for next commit
│   └── config                 # Repository config
├── src/                       # Pure Java VCS Engine Source Code
│   ├── commands/              # CLI commands (Add, Commit, Branch, Switch, etc.)
│   ├── constants/             # Repository paths & folder constants
│   ├── models/                # Commit, Branch, Repository entities
│   ├── services/              # Core VCS services (Stage, Commit, Branch, etc.)
│   ├── storage/               # FileManager filesystem operations
│   ├── utils/                 # HashUtil, DateUtil, PropertiesUtil
│   └── Main.java              # Java CLI entry point
├── working/                   # Active working directory tracked by GitLite
│   ├── login.txt
│   └── notes.txt
├── frontend/                  # Next.js 14 + Tailwind application
│   ├── app/                   # App router pages & API routes (/api/gitlite/*)
│   ├── components/            # Authentication, repository explorer, terminal UI
│   └── lib/gitlite.ts         # Bridge between Next.js and GitLite Java engine
├── gitlite.bat                # Windows CLI command wrapper
└── start-frontend.bat         # 1-click frontend launcher
```

---

## 🛠️ Built With

- **Java 21 LTS** — Java Version Control Engine
- **Next.js 14 (App Router)** — React Framework
- **TypeScript** — Type-Safe Application Architecture
- **Tailwind CSS** — GitHub Primer Dark & Light Color Tokens
- **Lucide React** — Interface icons
- **Canvas Confetti** — Interactive Release & Commit Celebrations