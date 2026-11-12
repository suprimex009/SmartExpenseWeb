import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

from fastapi import HTTPException
from fastapi.testclient import TestClient

os.environ["SMART_EXPENSE_DB"] = str(
    Path(tempfile.gettempdir()) / "moneta-test-import-only.db"
)
os.environ["MONETA_SECRET_KEY"] = "test-secret-key-with-at-least-thirty-two-characters"

from app import main as api


class ExpenseApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        api.DATABASE_PATH = Path(self.temp_directory.name) / "test-expenses.db"
        api.DATABASE_PATH.touch()
        with api.database() as connection:
            connection.execute("""
                CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_type TEXT NOT NULL,
                    category TEXT NOT NULL,
                    amount REAL NOT NULL,
                    transaction_date TEXT NOT NULL,
                    description TEXT
                )
            """)
            connection.execute("""
                CREATE TABLE monthly_budgets (
                    month TEXT PRIMARY KEY,
                    budget_amount REAL NOT NULL
                )
            """)
            connection.executemany("""
                INSERT INTO transactions (
                    transaction_type, category, amount, transaction_date, description
                ) VALUES (?, ?, ?, ?, ?)
            """, [
                ("Expense", "Food", 24.50, "2026-03-03", "Market"),
                ("Expense", "Travel", 15.00, "2026-03-15", "Bus"),
                ("Income", "Salary", 100.00, "2026-03-01", "Payday"),
                ("Expense", "Food", 30.00, date.today().isoformat(), "Coffee"),
            ])
            connection.execute(
                "INSERT INTO monthly_budgets (month, budget_amount) VALUES (?, ?)",
                ("2026-03", 80.00),
            )
        api.SESSION_SECRET_KEY = os.environ["MONETA_SECRET_KEY"]
        api.create_initial_owner("owner@example.com", "owner-password-123")
        self.client_context = TestClient(
            api.app,
            headers={"Origin": "http://127.0.0.1:5173"},
        )
        self.client = self.client_context.__enter__()
        response = self.client.post(
            "/api/auth/login",
            json={"email": "owner@example.com", "password": "owner-password-123"},
        )
        if response.status_code != 200:
            raise AssertionError(f"Could not sign test owner in: {response.text}")

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        self.temp_directory.cleanup()

    def test_health_and_existing_rows_are_preserved(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        result = self.client.get("/api/transactions")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["total"], 4)
        with api.database() as connection:
            self.assertEqual(
                connection.execute("SELECT COUNT(*) FROM monthly_budgets").fetchone()[0],
                1,
            )
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM account_monthly_budgets WHERE user_id = 1"
                ).fetchone()[0],
                1,
            )
            self.assertEqual(
                connection.execute(
                    "SELECT COUNT(*) FROM transactions WHERE user_id = 1"
                ).fetchone()[0],
                4,
            )
        self.assertEqual(
            self.client.get("/api/budgets?month=2026-03").json()["budget"],
            80.0,
        )

    def test_dashboard_totals_recent_transactions_and_budget(self):
        response = self.client.get("/api/dashboard?month=2026-03")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["income"], 100.0)
        self.assertEqual(payload["expenses"], 69.5)
        self.assertEqual(payload["balance"], 30.5)
        self.assertEqual(payload["monthly_expenses"], 39.5)
        self.assertEqual(len(payload["recent_transactions"]), 4)

    def test_search_filters_dates_and_custom_categories(self):
        response = self.client.get(
            "/api/transactions",
            params={
                "search": "bUs",
                "transaction_type": "Expense",
                "start_date": "2026-03-01",
                "end_date": "2026-03-31",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["items"][0]["category"], "Travel")
        self.assertIn("Travel", response.json()["categories"])
        invalid_range = self.client.get(
            "/api/transactions",
            params={"start_date": "2026-03-31", "end_date": "2026-03-01"},
        )
        self.assertEqual(invalid_range.status_code, 422)

    def test_create_update_delete_and_input_validation(self):
        payload = {
            "transaction_type": "Expense",
            "category": "Books",
            "amount": 12.75,
            "transaction_date": "2026-04-04",
            "description": "Reading",
        }
        created = self.client.post("/api/transactions", json=payload)
        self.assertEqual(created.status_code, 201)
        transaction_id = created.json()["id"]
        payload["amount"] = 20
        updated = self.client.put(
            f"/api/transactions/{transaction_id}", json=payload
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["amount"], 20)
        self.assertEqual(
            self.client.post(
                "/api/transactions",
                json={**payload, "amount": 0},
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.delete(f"/api/transactions/{transaction_id}").status_code,
            204,
        )
        self.assertEqual(
            self.client.delete(f"/api/transactions/{transaction_id}").status_code,
            404,
        )

    def test_budget_upsert_and_analytics_periods(self):
        updated = self.client.put(
            "/api/budgets/2026-03", json={"amount": 120.0}
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["budget"], 120.0)
        self.assertEqual(updated.json()["spent"], 39.5)
        self.assertEqual(
            self.client.put("/api/budgets/2026-99", json={"amount": 50}).status_code,
            422,
        )
        analytics = self.client.get("/api/analytics?period=all").json()
        self.assertEqual(
            sum(category["amount"] for category in analytics["categories"]),
            69.5,
        )
        with api.database() as connection:
            connection.execute("""
                INSERT INTO transactions (
                    transaction_type, category, amount, transaction_date, description
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                "Expense",
                "Future",
                999.0,
                date(date.today().year + 1, 1, 1).isoformat(),
                "Future entry",
            ))
        recent_analytics = self.client.get(
            "/api/analytics?period=last12"
        ).json()
        self.assertEqual(
            sum(category["amount"] for category in recent_analytics["categories"]),
            69.5,
        )
        self.assertEqual(
            self.client.get("/api/analytics?period=invalid").status_code,
            422,
        )

    def test_missing_database_is_not_created(self):
        original_path = api.DATABASE_PATH
        missing_path = Path(self.temp_directory.name) / "does-not-exist.db"
        api.DATABASE_PATH = missing_path
        try:
            with self.assertRaises(HTTPException) as error:
                with api.database():
                    pass
            self.assertEqual(error.exception.status_code, 503)
            self.assertFalse(missing_path.exists())
        finally:
            api.DATABASE_PATH = original_path

    def test_registration_login_logout_and_account_isolation(self):
        registration = self.client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": "new-user-password-123"},
        )
        self.assertEqual(registration.status_code, 201)
        self.assertIn("httponly", registration.headers["set-cookie"].lower())
        self.assertEqual(self.client.get("/api/auth/me").json()["email"], "new@example.com")
        self.assertEqual(self.client.get("/api/transactions").json()["total"], 0)
        self.assertEqual(self.client.get("/api/dashboard").json()["balance"], 0)
        self.assertIsNone(self.client.get("/api/budgets?month=2026-03").json()["budget"])
        self.assertEqual(
            self.client.put("/api/budgets/2026-03", json={"amount": 25}).status_code,
            200,
        )

        created = self.client.post("/api/transactions", json={
            "transaction_type": "Expense",
            "category": "Private",
            "amount": 5,
            "transaction_date": "2026-03-20",
        })
        self.assertEqual(created.status_code, 201)
        private_id = created.json()["id"]
        old_session = self.client.cookies.get(api.SESSION_COOKIE_NAME)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.client.cookies.set(api.SESSION_COOKIE_NAME, old_session)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

        login = self.client.post(
            "/api/auth/login",
            json={"email": "OWNER@example.com", "password": "owner-password-123"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(self.client.get("/api/transactions").json()["total"], 4)
        self.assertEqual(
            self.client.put(
                f"/api/transactions/{private_id}",
                json={
                    "transaction_type": "Expense",
                    "category": "Changed",
                    "amount": 55,
                    "transaction_date": "2026-03-20",
                },
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/login",
                json={"email": "owner@example.com", "password": "incorrect-password"},
            ).status_code,
            401,
        )

    def test_rejects_cross_origin_writes_and_weak_passwords(self):
        denied = self.client.post(
            "/api/auth/register",
            headers={"Origin": "https://untrusted.example"},
            json={"email": "visitor@example.com", "password": "visitor-password-123"},
        )
        self.assertEqual(denied.status_code, 403)
        weak = self.client.post(
            "/api/auth/register",
            json={"email": "visitor@example.com", "password": "short"},
        )
        self.assertEqual(weak.status_code, 422)

    def test_csv_uses_filters_and_neutralizes_formula_cells(self):
        with api.database() as connection:
            connection.execute("""
                UPDATE transactions SET description = '=1+1'
                WHERE category = 'Food' AND transaction_date = '2026-03-03'
            """)
        response = self.client.get(
            "/api/transactions/export.csv",
            params={"category": "Food", "start_date": "2026-03-01"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response.headers["content-type"])
        lines = response.content.decode("utf-8-sig").splitlines()
        self.assertEqual(len(lines), 3)
        self.assertTrue(any("'=1+1" in line for line in lines[1:]))


if __name__ == "__main__":
    unittest.main()
