# Moneta — Smart Expense Tracker

Moneta is a responsive React/Vite finance dashboard backed by FastAPI and SQLite. It supports sign-in and public account registration; each account has private transactions, budgets, and analytics.

## Database and account setup

The backend uses an existing SQLite database selected with the
`SMART_EXPENSE_DB` environment variable. Keep the database and all backups
outside this repository; they are ignored by Git as an additional safeguard.

The first-owner setup command opens a small dialog for your email and password. Password characters are masked in the dialog. It automatically makes another verified, timestamped backup immediately before updating the database. It:

- Adds an account ID to existing transactions and assigns those rows to the first owner.
- Copies the existing monthly budget into the account-specific budget table.
- Leaves the original `monthly_budgets` table and its data intact.
- Adds account/session tables; it does not delete transactions.
- Creates an SQLite trigger so rows added later by the legacy desktop app are assigned to the owner rather than becoming visible to other accounts.

Use the first-owner command only once. It opens a local dialog for your email
and password. Passwords are hashed with Argon2 and are not saved as plain text.
Afterward, other people can register their own accounts. They will not see your
data.

## Install on Windows

Install Node.js LTS if it is not already installed, then reopen the VS Code terminal:

```powershell
winget install --id OpenJS.NodeJS.LTS
```

Install backend dependencies:

```powershell
cd "C:\path\to\SmartExpenseWeb\backend"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell blocks activation, allow it for the current terminal only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Install frontend dependencies in another terminal:

```powershell
cd "C:\path\to\SmartExpenseWeb\frontend"
npm install
```

## Create your owner account

In the backend terminal, select the existing database and run the one-time setup. Enter the email and password in the dialog window that opens; password characters appear as masking symbols:

```powershell
cd "C:\path\to\SmartExpenseWeb\backend"
.\.venv\Scripts\Activate.ps1
$env:SMART_EXPENSE_DB = "C:\path\to\your\expenses.db"
python -m app.bootstrap_owner
```

Set `SMART_EXPENSE_DB` to the path of your existing SQLite database. Choose a
unique password with at least 12 characters. Do not send your password in chat
or commit it to source control.

## Run locally

Generate a signing secret and start the backend in terminal 1:

```powershell
cd "C:\path\to\SmartExpenseWeb\backend"
.\.venv\Scripts\Activate.ps1
$env:SMART_EXPENSE_DB = "C:\path\to\your\expenses.db"
$env:MONETA_SECRET_KEY = (py -c "import secrets; print(secrets.token_urlsafe(48))")
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The secret is for signing browser sessions. On a hosted server, configure one persistent, private `MONETA_SECRET_KEY` in the hosting provider's secret/environment settings; do not generate a new one on each restart.

Start the frontend in terminal 2:

```powershell
cd "C:\path\to\SmartExpenseWeb\frontend"
npm run dev
```

Open <http://127.0.0.1:5173>. Keep both terminals open. The API docs are available at <http://127.0.0.1:8000/docs>.

## Before making it public on the internet

The app now has per-account data isolation, Argon2 password hashes, signed `HttpOnly`/`SameSite=Lax` session cookies, exact-origin checks for write requests, and explicit CORS origins. Public registration creates a separate account; it does not grant access to the owner's records.

This is not, by itself, a hosted deployment. Before giving out a public URL:

1. Deploy behind HTTPS and a reverse proxy so the browser app and `/api` use the **same site/origin**. Keep the cookie `SameSite=Lax`; set `MONETA_COOKIE_SECURE=true`.
2. Set `MONETA_CORS_ORIGINS` to the exact HTTPS website origin(s), with no wildcard. Do not set it to `*`.
3. Configure `MONETA_SECRET_KEY` and `SMART_EXPENSE_DB` through the host's private settings.
4. Put the SQLite file on a persistent private disk, outside the public web root. Take encrypted, regular backups and test recovery.
5. Restrict server/API documentation and add hosting-level abuse/rate controls before inviting the public. SQLite on one persistent server is for a small personal app; use a managed database for a larger public service.

Never upload `expenses.db`, database backups, owner passwords, or session secrets into a public repository. The web app is for personal finance and is not a substitute for a professional security review before a public launch.

## Tests and build

The API tests create temporary databases, including for signup and account-isolation checks:

```powershell
cd "C:\path\to\SmartExpenseWeb\backend"
.\.venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
```

Build the production frontend:

```powershell
cd "C:\path\to\SmartExpenseWeb\frontend"
npm run build
```
