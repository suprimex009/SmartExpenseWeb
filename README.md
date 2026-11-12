# Moneta — Smart Expense Tracker

Moneta is a full-stack personal finance management web application designed to help users track income, expenses, budgets, and spending patterns through a responsive dashboard.

Built with **React, Vite, FastAPI, and PostgreSQL**, Moneta supports individual user accounts and keeps each user's financial records separate.

## Live Demo

- **Frontend:** https://moneta-frontend.onrender.com
- **Backend API:** https://moneta-backend-i7qa.onrender.com
- **API Documentation:** https://moneta-backend-i7qa.onrender.com/docs

*The backend is hosted on Render's free tier and may take a short time to wake up after inactivity.*

## Application Screenshots

### Dashboard
![Moneta Dashboard](docs/screenshots/dashboard.png)

### Transactions
![Moneta Transactions](docs/screenshots/transactions.png)

### Budget Management
![Moneta Budgets](docs/screenshots/budgets.png)

### Your Insights
![Moneta Your Insights](docs/screenshots/Your Insights.png)

## Features

- User registration, login, and logout.
- Individual user accounts and private financial records.
- Add and manage income and expense transactions.
- Categorize and search transactions.
- Create and manage budgets.
- Dashboard with financial summaries.
- Spending analytics and charts.
- CSV transaction export.
- Responsive interface for desktop and mobile.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | Supabase PostgreSQL |
| Database driver | Psycopg 3 |
| Charts | Recharts |
| Icons | Lucide React |
| Hosting | Render |
| Database hosting | Supabase |

## Architecture

Moneta uses a separate frontend and backend architecture.

1. The React frontend provides the user interface.
2. The frontend communicates with the FastAPI backend through HTTP API requests.
3. The backend validates requests and manages authentication and financial records.
4. PostgreSQL stores user accounts, transactions, and budgets.
5. User-specific queries keep financial records isolated between accounts.

## Deployment

- **Frontend hosting:** Render Static Site.
- **Backend hosting:** Render Web Service.
- **Database:** Supabase PostgreSQL, Mumbai region.
- **Frontend/backend communication:** HTTPS API requests with credentialed sessions.

## Local Development Setup

### Prerequisites

- Python 3.11 or newer.
- Node.js LTS.
- Git.
- A PostgreSQL database.

### 1. Clone the repository

```bash
git clone https://github.com/suprimex009/SmartExpenseWeb.git
cd SmartExpenseWeb
```

### 2. Configure the backend

```powershell
cd backend
py -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create a `.env` file using the supplied template:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and configure the following variables with your own values:

```dotenv
DATABASE_URL=YOUR_POSTGRESQL_CONNECTION_STRING
MONETA_SECRET_KEY=YOUR_PRIVATE_SECRET_KEY
MONETA_COOKIE_SECURE=false
MONETA_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Generate a signing secret using:

```powershell
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Keep your actual `.env` file private. Never commit database passwords or signing secrets.

### 3. Start the backend

From the `backend` directory:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend API:

`http://127.0.0.1:8000`

API documentation:

`http://127.0.0.1:8000/docs`

### 4. Install and start the frontend

Open another terminal:

```powershell
cd frontend
npm install
```

Create a frontend `.env` file containing:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the frontend:

```powershell
npm run dev
```

Open:

`http://localhost:5173`

Keep both development servers running while using the application.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL database connection |
| `MONETA_SECRET_KEY` | Signs browser sessions |
| `MONETA_COOKIE_SECURE` | Enables secure cookies over HTTPS |
| `MONETA_CORS_ORIGINS` | Specifies permitted frontend origins |
| `VITE_API_BASE_URL` | Specifies the backend API address for the frontend |

## Security

Moneta includes:

- Argon2 password hashing.
- Signed HTTP-only session cookies.
- HTTPS and secure-cookie configuration for deployment.
- Explicit CORS origin configuration.
- User-specific access to financial records.
- Environment-based storage of sensitive configuration.

The application is a personal finance management project and has not undergone an independent professional security audit.

## Project Structure

```text
SmartExpenseWeb/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── ...
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

## Future Improvements

- Improved financial reports.
- Additional data visualizations.
- Enhanced transaction filtering.
- Automated recurring transactions.
- Improved mobile experience.

## Author

Developed as a full-stack software development project to explore modern web technologies, backend API development, database integration, authentication, and deployment.