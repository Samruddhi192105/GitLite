# GitLite

GitLite is a Java version-control engine with a Next.js application for user
accounts, isolated repositories, file browsing, staging, commits, and branches.
Repository metadata and account data are stored in MongoDB; repository files
and snapshots are stored on the filesystem.

# Screenshots

<img width="959" height="412" alt="1" src="https://github.com/user-attachments/assets/f294d960-1a50-4129-b496-e462c42067d6" />

<img width="959" height="410" alt="2" src="https://github.com/user-attachments/assets/f5cb9c4a-1ae1-4bec-bf36-1e1c09697ddc" />

<img width="959" height="412" alt="3" src="https://github.com/user-attachments/assets/b8a93a1a-2304-4f2a-97d5-82314d9f261b" />

## Implemented features

- MongoDB-backed registration and sign-in with bcrypt password hashes and
  signed, HTTP-only sessions. Registration requires a separate sign-in.
- Owner-scoped repository list/create/read APIs and repository workspace routes.
- Separate filesystem roots for each account's repositories. API access checks
  repository ownership before reading or changing repository contents.
- Browser-based project and file uploads, file editing, renaming, and deletion.
- In-browser staging, commits, branches, branch switching, and commit checkout.
- Browser folder Clone, Push, and Pull using the File System Access API in
  desktop Chrome and Edge. The browser transfers files between a folder selected
  on the user's computer and the hosted GitLite repository; no local Git
  installation or CLI is required.
- Nested staged files and same-named files in different directories are kept
  distinct in snapshots.
- Checkout refuses to overwrite staged, modified, or untracked working files.
- Java integration tests run in temporary directories, and CI checks Java tests,
  TypeScript, and the production frontend build.

GitLite is designed to be used through its website; users do not need to install
the CLI or GitLite on their computers. Uploads support up to 10,000 files and
100 MB per batch; larger folders are split into sequential batches automatically.
Direct folder Clone, Push, and Pull are available in desktop Chrome and Edge,
require the user to select a folder and grant read/write access, and support up
to 100,000 files / 2 GB per sync. The selected folder handle and sync baseline
are saved in that browser's IndexedDB. On another computer, clone the repository
again into a separate folder; browser sync state is not shared between devices.
Other browsers can use **Add folder** to upload and download files individually,
but do not support direct folder Push/Pull. Merge support, cross-account
repository sharing, pull requests, issue tracking, CI workflows, and AI
features are not implemented.

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

### 2. Use GitLite in your browser

Open the deployed URL, sign up, sign in, and create a repository. To import an
existing project, open the repository and select **Add folder** to choose a
folder, or **Add files** to choose individual files. The folder structure is
preserved under `working/`. To get a repository onto your computer, select
**Clone to folder** and grant access to an empty folder. Chrome/Edge remember
the folder handle in that browser. On another computer, clone into a new folder;
browser sync state is not shared between devices.

Use **Stage & Commit** in the workspace to stage the uploaded changes and create
a commit. You can also edit, rename, or delete files in the browser, then stage
and commit those changes the same way. After local changes, select **Push** and
choose the same folder to upload the changes and create a hosted commit. To get
newer hosted commits, select **Pull** and choose that folder; Pull refuses to
overwrite local edits, so push them first or clone into a different folder.
GitLite skips `.git` and `.gitlite` directories in the selected computer folder
and does not read or modify its local Git metadata. In browsers without direct
folder access, use **Add folder** to upload and download files individually
from the repository viewer. The in-browser command console is optional; normal
repository work can be done with the workspace controls.

For local development of GitLite itself, the optional Java CLI wrapper is:

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

# Remove or move a working file (these operations stage the change)
.\gitlite.bat remove working/notes.txt
.\gitlite.bat move working/old-name.txt working/new-name.txt
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
