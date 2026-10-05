# GitLite Frontend

The GitLite frontend is a Next.js 14 application with a MongoDB Atlas-backed
account flow and a protected repository dashboard.

## Configure MongoDB Atlas

1. Create an Atlas database user and allow the application's IP address in the
   Atlas network access list.
2. Copy `.env.example` to `.env.local`.
3. Replace `MONGODB_URI` with the connection string for your Atlas cluster.
   URL-encode special characters in the database username or password.
4. Keep `MONGODB_DB=gitlite`, or choose another database name.
5. Set `AUTH_SECRET` to a private random value of at least 32 characters. For
   example, generate one in PowerShell with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Do not commit `.env.local` or expose these values in client-side code. Add the
   same environment variables to your hosting provider's server-side environment
   settings when deploying.

The application creates a `users` collection with a unique index on normalized
email addresses. Passwords are stored as bcrypt hashes. Sign-up confirms account
creation but does not sign the user in; sign in separately to receive an
HTTP-only, signed session cookie. The dashboard and GitLite API routes require
that session.

Repository names and owners are stored in a `repositories` collection with a
unique owner/name index. Repository files and commit snapshots live under
`.gitlite-data/` by default, not in MongoDB. Set `GITLITE_DATA_DIR` to a
persistent directory when deploying. Every app instance serving the same
repository must see the same durable filesystem; local ephemeral storage is not
suitable for production.

## Run locally

```powershell
npm ci
npm run dev
```

Open http://localhost:3000, create an account, then sign in. Create a repository
from the dashboard to open its workspace. The `predev`, `prebuild`, and
`prestart` npm scripts compile the Java engine to the ignored
`.gitlite-classes/` directory automatically. Java 21 and Node 20 or newer are
required.

The root `gitlite.bat` wrapper also recompiles the Java sources before running
the CLI, so CLI commands use the same current engine code as the web app.

Run the Java integration tests with `npm run test:java`. They compile into a
temporary directory and exercise initialization, nested staging, snapshot
contents, branch switching, checkout safety, and invalid paths without using
your local `.gitlite` repository.

Development output is isolated in `.next-dev/`; production build and start use
`.next/`. This prevents a production build from replacing chunks used by a
running development server. Restart an already-running dev server once after
updating this configuration so it begins using `.next-dev/`.
