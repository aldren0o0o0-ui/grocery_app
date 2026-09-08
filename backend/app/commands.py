import click
from flask import Flask
from app.extensions import db
from app.modules.auth.models import Role

DEFAULT_ROLES = [
    {"name": "OWNER", "description": "Business owner with full access"},
    {"name": "ADMIN", "description": "Administrator with management privileges"},
    {"name": "CASHIER", "description": "Cashier handling sales transactions"},
    {"name": "STAFF", "description": "General store staff for inventory and operations"},
]


def seed_roles_data() -> list[str]:
    """Idempotently seed the standard roles."""
    seeded = []
    for role_data in DEFAULT_ROLES:
        existing = db.session.execute(
            db.select(Role).filter_by(name=role_data["name"])
        ).scalar_one_or_none()
        if not existing:
            new_role = Role(name=role_data["name"], description=role_data["description"])
            db.session.add(new_role)
            seeded.append(role_data["name"])
    db.session.commit()
    return seeded


def register_commands(app: Flask) -> None:
    @app.cli.command("seed-roles")
    def seed_roles_command():
        """Idempotently seed standard application roles."""
        click.echo("Seeding initial roles...")
        seeded = seed_roles_data()
        if seeded:
            click.echo(f"Successfully created roles: {', '.join(seeded)}")
        else:
            click.echo("All initial roles already exist. No changes made.")

    @app.cli.command("create-owner")
    @click.option("--email", prompt="Owner Email", help="Email for the owner user")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True, help="Password for the owner user")
    @click.option("--first-name", prompt="First Name", default="Owner", help="First name")
    @click.option("--last-name", prompt="Last Name", default="User", help="Last name")
    def create_owner_command(email, password, first_name, last_name):
        """Safely create an initial OWNER account."""
        from app.modules.users.services import UserService
        from app.common.errors import AppError

        try:
            owner = UserService.create_owner(
                first_name=first_name,
                last_name=last_name,
                email=email,
                password=password,
            )
            click.echo(f"Successfully created OWNER account for '{owner.email}' (ID: {owner.id}).")
        except AppError as e:
            click.echo(f"Error creating owner: {e.message}", err=True)

    @app.cli.command("create-user")
    @click.option("--role", prompt="Role (OWNER, STAFF, CASHIER)", type=click.Choice(["OWNER", "STAFF", "CASHIER", "ADMIN"], case_sensitive=False), help="Role for the user")
    @click.option("--email", prompt="User Email", help="Email for the user")
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True, help="Password for the user")
    @click.option("--first-name", prompt="First Name", default="First", help="First name")
    @click.option("--last-name", prompt="Last Name", default="Last", help="Last name")
    def create_user_command(role, email, password, first_name, last_name):
        """Safely create a user account with any standard role (OWNER, STAFF, CASHIER)."""
        from app.modules.users.services import UserService
        from app.common.errors import AppError

        normalized_role = role.strip().upper()
        if normalized_role == "ADMIN":
            normalized_role = "OWNER"

        try:
            user = UserService.create_user(
                role_name=normalized_role,
                first_name=first_name,
                last_name=last_name,
                email=email,
                password=password,
            )
            click.echo(f"Successfully created {user.role.name} account for '{user.email}' (ID: {user.id}).")
        except AppError as e:
            click.echo(f"Error creating user: {e.message}", err=True)

    @app.cli.command("delete-all-users")
    @click.confirmation_option(prompt="Are you sure you want to delete ALL users and their audit logs?")
    def delete_all_users_command():
        """Delete all user accounts and audit logs for clean testing."""
        from sqlalchemy import text
        from app.extensions import db

        try:
            db.session.execute(text("DELETE FROM audit_logs;"))
            count = db.session.execute(text("DELETE FROM users;")).rowcount
            db.session.commit()
            click.echo(f"Successfully deleted all users ({count} removed) and cleared audit logs.")
        except Exception as e:
            db.session.rollback()
            click.echo(f"Error deleting users: {str(e)}", err=True)

