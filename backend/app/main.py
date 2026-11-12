import csv
import io
import math
import os
import re
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import date
from pathlib import Path
from typing import Generator, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pwdlib import PasswordHash
from pydantic import BaseModel, ConfigDict, Field, field_validator


DATABASE_PATH = Path(os.environ.get(
    "SMART_EXPENSE_DB",
    Path(__file__).resolve().parents[2] / "expenses.db",
))
SESSION_SECRET_KEY = os.environ.get("MONETA_SECRET_KEY", "")
SESSION_COOKIE_SECURE = os.environ.get("MONETA_COOKIE_SECURE", "false").lower() == "true"
SESSION_COOKIE_NAME = "moneta_session"
SESSION_MAX_AGE = 60 * 60 * 12
PASSWORD_HASHER = PasswordHash.recommended()
PASSWORD_HASHER_DUMMY = PASSWORD_HASHER.hash("not-a-real-password")
DEV_ORIGINS = ("http://127.0.0.1:5173", "http://localhost:5173")
CONFIGURED_ORIGINS = tuple(
    origin.strip().rstrip("/")
    for origin in os.environ.get("MONETA_CORS_ORIGINS", "").split(",")
    if origin.strip()
)
ALLOWED_ORIGINS = CONFIGURED_ORIGINS or DEV_ORIGINS
ALLOWED_TABLES = {
    "transactions",
    "monthly_budgets",
    "account_monthly_budgets",
    "users",
    "app_settings",
}


def session_serializer() -> URLSafeTimedSerializer:
    if len(SESSION_SECRET_KEY) < 32:
        raise HTTPException(
            status_code=503,
            detail="Server authentication is not configured. Set MONETA_SECRET_KEY.",
        )
    return URLSafeTimedSerializer(SESSION_SECRET_KEY, salt="moneta-auth-v1")


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin", "").rstrip("/")
    if not origin or origin not in ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Request origin is not allowed.")


def get_current_user(request: Request) -> sqlite3.Row:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    try:
        session = session_serializer().loads(token, max_age=SESSION_MAX_AGE)
        user_id = int(session["user_id"])
        session_version = int(session["session_version"])
    except (BadSignature, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.") from None
    with database() as connection:
        user = connection.execute(
            "SELECT id, email, session_version FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if user is None or user["session_version"] != session_version:
        raise HTTPException(status_code=401, detail="Your account is unavailable. Please sign in again.")
    return user


def set_session_cookie(response: Response, user_id: int, session_version: int) -> None:
    token = session_serializer().dumps({
        "user_id": user_id,
        "session_version": session_version,
    })
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def validate_email(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


def create_initial_owner(email: str, password: str) -> None:
    """Prepare account isolation and assign all legacy rows to the first owner."""
    email = validate_email(email)
    if not 12 <= len(password) <= 128:
        raise ValueError("Password must be between 12 and 128 characters.")
    password_hash = PASSWORD_HASHER.hash(password)

    with database() as connection:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                session_version INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        user_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(users)")
        }
        if "session_version" not in user_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0"
            )
        connection.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        user_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(transactions)")
        }
        if "user_id" not in user_columns:
            connection.execute(
                "ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)"
            )

        account_budget_table = connection.execute("""
            SELECT 1 FROM sqlite_master
            WHERE type = 'table' AND name = 'account_monthly_budgets'
        """).fetchone()
        if not account_budget_table:
            connection.execute("""
                CREATE TABLE account_monthly_budgets (
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    month TEXT NOT NULL,
                    budget_amount REAL NOT NULL,
                    PRIMARY KEY (user_id, month)
                )
            """)

        existing_users = connection.execute(
            "SELECT id FROM users ORDER BY id LIMIT 1"
        ).fetchone()
        if existing_users:
            raise RuntimeError(
                "An owner account already exists. Initial setup can only run once."
            )

        cursor = connection.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash),
        )
        owner_id = cursor.lastrowid
        connection.execute(
            "UPDATE transactions SET user_id = ? WHERE user_id IS NULL",
            (owner_id,),
        )
        if not account_budget_table:
            connection.execute("""
                INSERT INTO account_monthly_budgets (user_id, month, budget_amount)
                SELECT ?, month, budget_amount FROM monthly_budgets
            """, (owner_id,))
        connection.execute(
            "INSERT INTO app_settings (key, value) VALUES ('legacy_owner_id', ?)",
            (str(owner_id),),
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_date "
            "ON transactions(user_id, transaction_date, id)"
        )
        connection.execute("""
            CREATE TRIGGER IF NOT EXISTS assign_legacy_transaction_owner
            AFTER INSERT ON transactions
            WHEN NEW.user_id IS NULL
            BEGIN
                UPDATE transactions
                SET user_id = (
                    SELECT CAST(value AS INTEGER)
                    FROM app_settings WHERE key = 'legacy_owner_id'
                )
                WHERE id = NEW.id;
            END
        """)


@contextmanager
def database() -> Generator[sqlite3.Connection, None, None]:
    if not DATABASE_PATH.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"SQLite database not found: {DATABASE_PATH}",
        )
    connection = sqlite3.connect(
        DATABASE_PATH.resolve().as_uri() + "?mode=rw",
        uri=True,
        timeout=10,
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"Database operation failed: {error}",
        ) from error
    finally:
        connection.close()


def verify_database() -> None:
    if len(SESSION_SECRET_KEY) < 32:
        raise RuntimeError(
            "MONETA_SECRET_KEY must be configured with at least 32 characters."
        )
    if not DATABASE_PATH.is_file():
        raise RuntimeError(
            f"Database not found at {DATABASE_PATH}. "
            "Set SMART_EXPENSE_DB to the existing database path."
        )
    with database() as connection:
        tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        missing = ALLOWED_TABLES - tables
        if missing:
            raise RuntimeError(
                "Existing database is missing required tables: "
                + ", ".join(sorted(missing))
            )
        transaction_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(transactions)")
        }
        budget_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(account_monthly_budgets)")
        }
        expected_transactions = {
            "id", "transaction_type", "category", "amount",
            "transaction_date", "description",
        }
        expected_budgets = {"month", "budget_amount"}
        if not (expected_transactions | {"user_id"}) <= transaction_columns:
            raise RuntimeError("Transactions are not account-scoped. Run the owner setup command.")
        if not (expected_budgets | {"user_id"}) <= budget_columns:
            raise RuntimeError("Budgets are not account-scoped. Run the owner setup command.")
        if not connection.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            raise RuntimeError("No owner account exists. Run the owner setup command.")
        if not connection.execute(
            "SELECT 1 FROM app_settings WHERE key = 'legacy_owner_id'"
        ).fetchone():
            raise RuntimeError("Database ownership setup is incomplete.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    verify_database()
    yield


app = FastAPI(
    title="Smart Expense Tracker API",
    version="1.0.0",
    description="Account-protected API for the Smart Expense Tracker SQLite database.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


class AccountInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return validate_email(value)


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return validate_email(value)


class TransactionInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    transaction_type: Literal["Income", "Expense"]
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0, allow_inf_nan=False)
    transaction_date: date
    description: str | None = Field(default=None, max_length=500)

    @field_validator("category")
    @classmethod
    def category_is_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Category cannot be blank.")
        return value

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        return value or None


class BudgetInput(BaseModel):
    amount: float = Field(gt=0, allow_inf_nan=False)


def month_bounds(month: str) -> tuple[str, str]:
    try:
        year, month_number = (int(part) for part in month.split("-"))
        start = date(year, month_number, 1)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM format.",
        ) from None
    if start.strftime("%Y-%m") != month:
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM format.",
        )
    if month_number == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month_number + 1, 1)
    return start.isoformat(), next_month.isoformat()


def transaction_filters(
    user_id: int,
    search: str,
    transaction_type: str,
    category: str,
    start_date: date | None,
    end_date: date | None,
) -> tuple[str, list[object]]:
    conditions = ["user_id = ?"]
    parameters: list[object] = [user_id]
    search = search.strip()
    if search:
        conditions.append("""(
            instr(lower(CAST(id AS TEXT)), lower(?)) > 0
            OR instr(lower(transaction_type), lower(?)) > 0
            OR instr(lower(category), lower(?)) > 0
            OR instr(lower(CAST(amount AS TEXT)), lower(?)) > 0
            OR instr(lower(transaction_date), lower(?)) > 0
            OR instr(lower(COALESCE(description, '')), lower(?)) > 0
        )""")
        parameters.extend([search] * 6)
    if transaction_type != "All":
        conditions.append("transaction_type = ?")
        parameters.append(transaction_type)
    if category != "All":
        conditions.append("category = ?")
        parameters.append(category)
    if start_date:
        conditions.append("transaction_date >= ?")
        parameters.append(start_date.isoformat())
    if end_date:
        conditions.append("transaction_date <= ?")
        parameters.append(end_date.isoformat())
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="The start date must be on or before the end date.",
        )
    return " AND ".join(conditions), parameters


def serialize_transaction(row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "transaction_type": row["transaction_type"],
        "category": row["category"],
        "amount": row["amount"],
        "transaction_date": row["transaction_date"],
        "description": row["description"] or "",
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    verify_database()
    return {"status": "ok"}


@app.post("/api/auth/register", status_code=201)
def register(
    item: AccountInput,
    response: Response,
    _: None = Depends(require_same_origin),
) -> dict[str, str]:
    with database() as connection:
        existing = connection.execute(
            "SELECT 1 FROM users WHERE email = ?",
            (item.email,),
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )
        try:
            cursor = connection.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (item.email, PASSWORD_HASHER.hash(item.password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            ) from None
        user_id = cursor.lastrowid
    set_session_cookie(response, user_id, 0)
    return {"id": str(user_id), "email": item.email}


@app.post("/api/auth/login")
def login(
    item: LoginInput,
    response: Response,
    _: None = Depends(require_same_origin),
) -> dict[str, str]:
    with database() as connection:
        user = connection.execute(
            "SELECT id, email, password_hash, session_version FROM users WHERE email = ?",
            (item.email,),
        ).fetchone()
    password_hash = user["password_hash"] if user else PASSWORD_HASHER_DUMMY
    password_matches = PASSWORD_HASHER.verify(item.password, password_hash)
    if user is None or not password_matches:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    set_session_cookie(response, user["id"], user["session_version"])
    return {"id": str(user["id"]), "email": user["email"]}


@app.get("/api/auth/me")
def current_account(
    user: sqlite3.Row = Depends(get_current_user),
) -> dict[str, str]:
    return {"id": str(user["id"]), "email": user["email"]}


@app.post("/api/auth/logout", status_code=204)
def logout(
    response: Response,
    _: None = Depends(require_same_origin),
    __: sqlite3.Row = Depends(get_current_user),
) -> Response:
    response.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
    )
    with database() as connection:
        connection.execute(
            "UPDATE users SET session_version = session_version + 1 WHERE id = ?",
            (__["id"],),
        )
    response.status_code = 204
    return response


@app.get("/api/dashboard")
def dashboard(
    month: str = Query(default_factory=lambda: date.today().strftime("%Y-%m")),
    user: sqlite3.Row = Depends(get_current_user),
):
    start, end = month_bounds(month)
    with database() as connection:
        totals = connection.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN transaction_type = 'Income'
                                  THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN transaction_type = 'Expense'
                                  THEN amount ELSE 0 END), 0) AS expenses
            FROM transactions
            WHERE user_id = ?
        """, (user["id"],)).fetchone()
        monthly = connection.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN transaction_type = 'Income'
                                  THEN amount ELSE 0 END), 0) AS income,
                COALESCE(SUM(CASE WHEN transaction_type = 'Expense'
                                  THEN amount ELSE 0 END), 0) AS expenses
            FROM transactions
            WHERE user_id = ? AND transaction_date >= ? AND transaction_date < ?
        """, (user["id"], start, end)).fetchone()
        budget = connection.execute(
            "SELECT budget_amount FROM account_monthly_budgets WHERE user_id = ? AND month = ?",
            (user["id"], month),
        ).fetchone()
        recent = connection.execute("""
            SELECT id, transaction_type, category, amount,
                   transaction_date, description
            FROM transactions
            WHERE user_id = ?
            ORDER BY transaction_date DESC, id DESC
            LIMIT 8
        """, (user["id"],)).fetchall()
    return {
        "income": totals["income"],
        "expenses": totals["expenses"],
        "balance": totals["income"] - totals["expenses"],
        "month": month,
        "monthly_income": monthly["income"],
        "monthly_expenses": monthly["expenses"],
        "monthly_budget": budget["budget_amount"] if budget else None,
        "recent_transactions": [serialize_transaction(row) for row in recent],
    }


@app.get("/api/transactions")
def list_transactions(
    search: str = "",
    transaction_type: Literal["All", "Income", "Expense"] = "All",
    category: str = "All",
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
    offset: int = Query(default=0, ge=0),
    user: sqlite3.Row = Depends(get_current_user),
):
    where, parameters = transaction_filters(
        user["id"], search, transaction_type, category, start_date, end_date
    )
    with database() as connection:
        total = connection.execute(
            f"SELECT COUNT(*) FROM transactions WHERE {where}",
            parameters,
        ).fetchone()[0]
        rows = connection.execute(
            f"""
            SELECT id, transaction_type, category, amount,
                   transaction_date, description
            FROM transactions
            WHERE {where}
            ORDER BY transaction_date DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            [*parameters, limit, offset],
        ).fetchall()
        categories = [
            row["category"]
            for row in connection.execute("""
                SELECT DISTINCT category
                FROM transactions
                WHERE user_id = ? AND category IS NOT NULL AND category != ''
                ORDER BY category COLLATE NOCASE
            """, (user["id"],))
        ]
    return {
        "items": [serialize_transaction(row) for row in rows],
        "total": total,
        "categories": categories,
    }


@app.post("/api/transactions", status_code=201)
def create_transaction(
    item: TransactionInput,
    _: None = Depends(require_same_origin),
    user: sqlite3.Row = Depends(get_current_user),
):
    with database() as connection:
        cursor = connection.execute("""
            INSERT INTO transactions (
                transaction_type, category, amount, transaction_date, description, user_id
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            item.transaction_type,
            item.category,
            item.amount,
            item.transaction_date.isoformat(),
            item.description,
            user["id"],
        ))
        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return serialize_transaction(row)


@app.put("/api/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int,
    item: TransactionInput,
    _: None = Depends(require_same_origin),
    user: sqlite3.Row = Depends(get_current_user),
):
    with database() as connection:
        cursor = connection.execute("""
            UPDATE transactions
            SET transaction_type = ?, category = ?, amount = ?,
                transaction_date = ?, description = ?
            WHERE id = ? AND user_id = ?
        """, (
            item.transaction_type,
            item.category,
            item.amount,
            item.transaction_date.isoformat(),
            item.description,
            transaction_id,
            user["id"],
        ))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transaction not found.")
        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
            (transaction_id, user["id"]),
        ).fetchone()
    return serialize_transaction(row)


@app.delete("/api/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    _: None = Depends(require_same_origin),
    user: sqlite3.Row = Depends(get_current_user),
) -> Response:
    with database() as connection:
        cursor = connection.execute(
            "DELETE FROM transactions WHERE id = ? AND user_id = ?",
            (transaction_id, user["id"]),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transaction not found.")
    return Response(status_code=204)


@app.get("/api/budgets")
def get_budget(
    month: str = Query(default_factory=lambda: date.today().strftime("%Y-%m")),
    user: sqlite3.Row = Depends(get_current_user),
):
    start, end = month_bounds(month)
    with database() as connection:
        budget = connection.execute(
            "SELECT budget_amount FROM account_monthly_budgets WHERE user_id = ? AND month = ?",
            (user["id"], month),
        ).fetchone()
        spent = connection.execute("""
            SELECT COALESCE(SUM(amount), 0)
            FROM transactions
            WHERE user_id = ? AND transaction_type = 'Expense'
              AND transaction_date >= ? AND transaction_date < ?
        """, (user["id"], start, end)).fetchone()[0]
    amount = budget["budget_amount"] if budget else None
    return {
        "month": month,
        "budget": amount,
        "spent": spent,
        "remaining": amount - spent if amount is not None else None,
        "progress": spent / amount if amount else 0,
    }


@app.put("/api/budgets/{month}")
def save_budget(
    month: str,
    item: BudgetInput,
    _: None = Depends(require_same_origin),
    user: sqlite3.Row = Depends(get_current_user),
):
    month_bounds(month)
    if not math.isfinite(item.amount):
        raise HTTPException(status_code=422, detail="Budget must be a finite amount.")
    with database() as connection:
        connection.execute("""
            INSERT INTO account_monthly_budgets (user_id, month, budget_amount)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, month)
            DO UPDATE SET budget_amount = excluded.budget_amount
        """, (user["id"], month, item.amount))
    return get_budget(month, user)

@app.get("/api/analytics")
def analytics(
    period: Literal["all", "last12", "year"] = "all",
    user: sqlite3.Row = Depends(get_current_user),
):
    today = date.today()
    if period == "last12":
        month_index = today.year * 12 + today.month - 1 - 11
        first_month = f"{month_index // 12:04d}-{month_index % 12 + 1:02d}"
        filter_clause = (
            "substr(transaction_date, 1, 7) >= ? "
            "AND substr(transaction_date, 1, 7) <= ?"
        )
        parameters: tuple[str, ...] = (first_month, today.strftime("%Y-%m"))
    elif period == "year":
        filter_clause = "substr(transaction_date, 1, 4) = ?"
        parameters = (today.strftime("%Y"),)
    else:
        filter_clause = "1 = 1"
        parameters = ()
    with database() as connection:
        categories = connection.execute(f"""
            SELECT category, SUM(amount) AS amount
            FROM transactions
            WHERE user_id = ? AND transaction_type = 'Expense' AND {filter_clause}
            GROUP BY category
            ORDER BY amount DESC
        """, (user["id"], *parameters)).fetchall()
        months = connection.execute(f"""
            SELECT substr(transaction_date, 1, 7) AS month,
                   SUM(CASE WHEN transaction_type = 'Income'
                            THEN amount ELSE 0 END) AS income,
                   SUM(CASE WHEN transaction_type = 'Expense'
                            THEN amount ELSE 0 END) AS expenses
            FROM transactions
            WHERE user_id = ? AND {filter_clause}
            GROUP BY substr(transaction_date, 1, 7)
            ORDER BY month
        """, (user["id"], *parameters)).fetchall()
    return {
        "categories": [
            {"category": row["category"], "amount": row["amount"]}
            for row in categories
        ],
        "months": [dict(row) for row in months],
    }


def csv_safe(value: object) -> object:
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


@app.get("/api/transactions/export.csv")
def export_transactions(
    search: str = "",
    transaction_type: Literal["All", "Income", "Expense"] = "All",
    category: str = "All",
    start_date: date | None = None,
    end_date: date | None = None,
    user: sqlite3.Row = Depends(get_current_user),
):
    where, parameters = transaction_filters(
        user["id"], search, transaction_type, category, start_date, end_date
    )
    with database() as connection:
        rows = connection.execute(
            f"""
            SELECT id, transaction_type, category, amount,
                   transaction_date, description
            FROM transactions
            WHERE {where}
            ORDER BY transaction_date DESC, id DESC
            """,
            parameters,
        ).fetchall()
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow((
        "ID", "Type", "Category", "Amount", "Date", "Description"
    ))
    for row in rows:
        writer.writerow(csv_safe(value) for value in row)
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="transactions.csv"'},
    )
