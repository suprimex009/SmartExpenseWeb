import sqlite3
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import ttk

from .main import DATABASE_PATH, create_initial_owner, validate_email


def validate_owner_credentials(
    email: str,
    password: str,
    confirmation: str,
) -> tuple[str, str]:
    normalized_email = validate_email(email)
    if not 12 <= len(password) <= 128:
        raise ValueError("Password must be between 12 and 128 characters.")
    if password != confirmation:
        raise ValueError("Passwords do not match. Please enter them again.")
    return normalized_email, password


def prompt_owner_credentials() -> tuple[str, str]:
    root = tk.Tk()
    root.title("Moneta owner setup")
    root.resizable(False, False)
    root.protocol("WM_DELETE_WINDOW", root.destroy)
    frame = ttk.Frame(root, padding=20)
    frame.grid(sticky="nsew")
    email = tk.StringVar()
    password = tk.StringVar()
    confirmation = tk.StringVar()
    result: dict[str, str] = {}
    error = tk.StringVar()

    ttk.Label(frame, text="Create your private Moneta owner account").grid(
        row=0, column=0, columnspan=2, sticky="w", pady=(0, 14)
    )
    ttk.Label(frame, text="Email address").grid(row=1, column=0, sticky="w")
    email_field = ttk.Entry(frame, textvariable=email, width=42)
    email_field.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(3, 10))
    ttk.Label(frame, text="Password (12-128 characters)").grid(
        row=3, column=0, sticky="w"
    )
    ttk.Entry(frame, textvariable=password, show="*", width=42).grid(
        row=4, column=0, columnspan=2, sticky="ew", pady=(3, 10)
    )
    ttk.Label(frame, text="Confirm password").grid(row=5, column=0, sticky="w")
    ttk.Entry(frame, textvariable=confirmation, show="*", width=42).grid(
        row=6, column=0, columnspan=2, sticky="ew", pady=(3, 8)
    )
    ttk.Label(frame, textvariable=error, foreground="#b42318").grid(
        row=7, column=0, columnspan=2, sticky="w"
    )

    def submit() -> None:
        try:
            normalized_email, entered_password = validate_owner_credentials(
                email.get(),
                password.get(),
                confirmation.get(),
            )
        except ValueError as validation_error:
            error.set(str(validation_error))
            return
        result["email"] = normalized_email
        result["password"] = entered_password
        root.destroy()

    ttk.Button(frame, text="Cancel", command=root.destroy).grid(
        row=8, column=0, sticky="e", pady=(12, 0), padx=(0, 8)
    )
    ttk.Button(frame, text="Create owner account", command=submit).grid(
        row=8, column=1, sticky="e", pady=(12, 0)
    )
    root.bind("<Return>", lambda _event: submit())
    email_field.focus_set()
    root.mainloop()

    if not result:
        raise SystemExit("Owner setup cancelled. No database changes were made.")
    return result["email"], result["password"]


def create_database_backup(database_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = database_path.with_name(
        f"{database_path.stem}.pre-auth-{timestamp}{database_path.suffix}"
    )
    if backup_path.exists():
        raise FileExistsError(f"Backup already exists: {backup_path}")
    source = sqlite3.connect(
        database_path.resolve().as_uri() + "?mode=ro",
        uri=True,
    )
    destination = sqlite3.connect(backup_path)
    try:
        source.backup(destination)
        integrity = destination.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise sqlite3.DatabaseError(
                f"Backup integrity check failed: {integrity}"
            )
    finally:
        destination.close()
        source.close()
    return backup_path


def main() -> None:
    email, password = prompt_owner_credentials()
    try:
        backup_path = create_database_backup(DATABASE_PATH)
        create_initial_owner(email, password)
    except (ValueError, RuntimeError) as error:
        raise SystemExit(f"Owner setup failed: {error}") from error
    except sqlite3.Error as error:
        raise SystemExit(f"Could not back up or update the database: {error}") from error
    print(f"Verified database backup created: {backup_path}")
    print(f"Owner account created and existing records assigned: {DATABASE_PATH}")
    print("Your original transactions and monthly_budgets table remain in the database.")


if __name__ == "__main__":
    main()
