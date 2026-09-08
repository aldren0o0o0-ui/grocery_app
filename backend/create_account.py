"""Interactive helper script to create user accounts for the Grocery SME Management System.

Usage:
    python create_account.py
    python create_account.py --role OWNER --email owner@grocery.local --password password123 --first-name Super --last-name Owner
"""

import argparse
import sys
import getpass

from app import create_app
from app.modules.users.services import UserService
from app.common.errors import AppError


def main():
    parser = argparse.ArgumentParser(description="Create a user account for testing.")
    parser.add_argument("--role", choices=["OWNER", "ADMIN", "STAFF", "CASHIER"], help="User role")
    parser.add_argument("--email", help="User email address")
    parser.add_argument("--password", help="User password (at least 8 characters)")
    parser.add_argument("--first-name", help="User first name")
    parser.add_argument("--last-name", help="User last name")

    args = parser.parse_args()

    print("=" * 55)
    print(" Grocery SME Management System - Account Provisioning ")
    print("=" * 55)

    role = args.role
    if role:
        role = role.strip().upper()
        if role == "ADMIN":
            role = "OWNER"

    if not role:
        print("\nSelect user role:")
        print("  1. OWNER   (Owner / Admin - Full management: catalog, inventory, suppliers)")
        print("  2. STAFF   (General store staff - operational view, read-only catalog/suppliers)")
        print("  3. CASHIER (POS sales and checkout)")
        choice = input("Enter choice [1-3] or role name: ").strip()
        role_map = {
            "1": "OWNER",
            "2": "STAFF",
            "3": "CASHIER",
            "OWNER": "OWNER",
            "ADMIN": "OWNER",
            "STAFF": "STAFF",
            "CASHIER": "CASHIER",
        }
        role = role_map.get(choice, choice.upper())
        if role == "ADMIN":
            role = "OWNER"

    first_name = args.first_name
    if not first_name:
        first_name = input("First Name: ").strip() or "Test"

    last_name = args.last_name
    if not last_name:
        last_name = input("Last Name: ").strip() or "User"

    email = args.email
    if not email:
        email = input("Email: ").strip()

    password = args.password
    if not password:
        password = getpass.getpass("Password (min 8 chars): ")
        password_confirm = getpass.getpass("Confirm Password: ")
        if password != password_confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    app = create_app()
    with app.app_context():
        try:
            user = UserService.create_user(
                role_name=role,
                first_name=first_name,
                last_name=last_name,
                email=email,
                password=password,
            )
            print("-" * 55)
            print(f"SUCCESS: Account created successfully!")
            print(f"  ID:         {user.id}")
            print(f"  Role:       {user.role.name}")
            print(f"  Name:       {user.first_name} {user.last_name}")
            print(f"  Email:      {user.email}")
            print(f"  Status:     {'Active' if user.is_active else 'Inactive'}")
            print("-" * 55)
        except AppError as e:
            print(f"Error [{e.code}]: {e.message}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Unexpected error: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
