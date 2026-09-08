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

