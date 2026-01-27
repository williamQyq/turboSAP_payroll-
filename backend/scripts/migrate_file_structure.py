#!/usr/bin/env python3
"""
File Structure Migration Script

Migrates configuration files from the legacy structure to the new organized structure.

This script is idempotent - safe to run multiple times.
It will skip files that have already been migrated.

Usage:
    cd backend
    python scripts/migrate_file_structure.py

    # Dry run (show what would be done without making changes)
    python scripts/migrate_file_structure.py --dry-run

    # Verbose output
    python scripts/migrate_file_structure.py --verbose

Migration Plan:
    OLD LOCATION                                    -> NEW LOCATION
    -------------------------------------------------------------------------------
    app/data/payment_method_questions.json          -> app/data/modules/payment-methods/questions.json
    app/data/payment_method_questions_backup.json   -> app/data/modules/payment-methods/questions_backup.json
    app/config/questions_current.json               -> app/data/modules/payroll-area/questions.json
    app/config/questions_backup.json                -> app/data/modules/payroll-area/questions_backup.json
    app/config/questions_original.json              -> app/data/modules/payroll-area/questions_original.json
    app/data/modules_metadata.json                  -> app/data/metadata/modules.json
"""

import argparse
import json
import logging
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class MigrationStep:
    """Represents a single file migration step."""
    source: Path
    destination: Path
    description: str
    required: bool = True  # If True, fail if source doesn't exist


def get_app_root() -> Path:
    """Get the app root directory (backend/app)."""
    # This script is in backend/scripts/, so app is at ../app
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent / "app"


def get_migration_steps(app_root: Path) -> List[MigrationStep]:
    """Define all migration steps."""
    data_dir = app_root / "data"
    config_dir = app_root / "config"
    modules_dir = data_dir / "modules"
    metadata_dir = data_dir / "metadata"

    return [
        # Payment method questions
        MigrationStep(
            source=data_dir / "payment_method_questions.json",
            destination=modules_dir / "payment-methods" / "questions.json",
            description="Payment method questions",
            required=True,
        ),
        MigrationStep(
            source=data_dir / "payment_method_questions_backup.json",
            destination=modules_dir / "payment-methods" / "questions_backup.json",
            description="Payment method questions backup",
            required=False,
        ),

        # Payroll area questions
        MigrationStep(
            source=config_dir / "questions_current.json",
            destination=modules_dir / "payroll-area" / "questions.json",
            description="Payroll area questions",
            required=True,
        ),
        MigrationStep(
            source=config_dir / "questions_backup.json",
            destination=modules_dir / "payroll-area" / "questions_backup.json",
            description="Payroll area questions backup",
            required=False,
        ),
        MigrationStep(
            source=config_dir / "questions_original.json",
            destination=modules_dir / "payroll-area" / "questions_original.json",
            description="Payroll area original questions",
            required=False,
        ),

        # Modules metadata
        MigrationStep(
            source=data_dir / "modules_metadata.json",
            destination=metadata_dir / "modules.json",
            description="Modules metadata",
            required=True,
        ),
    ]


def check_preconditions(steps: List[MigrationStep]) -> List[str]:
    """
    Check that all required source files exist.

    Returns list of error messages (empty if all OK).
    """
    errors = []

    for step in steps:
        if step.required and not step.source.exists():
            errors.append(f"Required source file not found: {step.source}")

    return errors


def is_already_migrated(step: MigrationStep) -> bool:
    """
    Check if a file has already been migrated.

    A file is considered migrated if:
    - Destination exists AND
    - Source doesn't exist (was moved, not copied)
    OR
    - Destination exists AND has same content as source
    """
    if not step.destination.exists():
        return False

    if not step.source.exists():
        # Source was already moved
        return True

    # Both exist - check if content matches
    try:
        with step.source.open() as f:
            source_content = json.load(f)
        with step.destination.open() as f:
            dest_content = json.load(f)
        return source_content == dest_content
    except (json.JSONDecodeError, OSError):
        return False


def migrate_file(step: MigrationStep, dry_run: bool = False) -> bool:
    """
    Migrate a single file.

    Returns True if migration was performed, False if skipped.
    """
    # Check if already migrated
    if is_already_migrated(step):
        logger.info(f"[SKIP] {step.description} - already migrated")
        return False

    # Check source exists
    if not step.source.exists():
        if step.required:
            raise FileNotFoundError(f"Source file not found: {step.source}")
        else:
            logger.debug(f"[SKIP] {step.description} - source not found (optional)")
            return False

    if dry_run:
        logger.info(f"[DRY-RUN] Would migrate: {step.source} -> {step.destination}")
        return True

    # Create destination directory
    step.destination.parent.mkdir(parents=True, exist_ok=True)

    # Copy file (we'll remove source after all copies succeed)
    shutil.copy2(step.source, step.destination)
    logger.info(f"[COPY] {step.source} -> {step.destination}")

    return True


def cleanup_source_files(steps: List[MigrationStep], dry_run: bool = False) -> None:
    """
    Remove source files after successful migration.

    Only removes files that have been successfully migrated (destination exists
    and matches source).
    """
    for step in steps:
        if not step.source.exists():
            continue

        if not step.destination.exists():
            continue

        # Verify content matches before removing
        try:
            with step.source.open() as f:
                source_content = json.load(f)
            with step.destination.open() as f:
                dest_content = json.load(f)

            if source_content == dest_content:
                if dry_run:
                    logger.info(f"[DRY-RUN] Would remove: {step.source}")
                else:
                    step.source.unlink()
                    logger.info(f"[REMOVE] {step.source}")
            else:
                logger.warning(f"[KEEP] {step.source} - content differs from destination")

        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"[KEEP] {step.source} - error comparing: {e}")


def create_symlinks_for_compatibility(steps: List[MigrationStep], dry_run: bool = False) -> None:
    """
    Create symlinks from old locations to new locations for backward compatibility.

    This allows old code that hasn't been updated to still find the files.
    """
    for step in steps:
        if step.source.exists() or step.source.is_symlink():
            # Don't create symlink if source still exists or is already a symlink
            continue

        if not step.destination.exists():
            continue

        if dry_run:
            logger.info(f"[DRY-RUN] Would create symlink: {step.source} -> {step.destination}")
        else:
            try:
                # Create relative symlink
                relative_dest = step.destination.relative_to(step.source.parent)
                step.source.symlink_to(relative_dest)
                logger.info(f"[SYMLINK] {step.source} -> {relative_dest}")
            except (ValueError, OSError) as e:
                # Fall back to absolute path if relative fails
                try:
                    step.source.symlink_to(step.destination)
                    logger.info(f"[SYMLINK] {step.source} -> {step.destination}")
                except OSError as e2:
                    logger.warning(f"[SKIP-SYMLINK] Could not create symlink {step.source}: {e2}")


def verify_migration(steps: List[MigrationStep]) -> List[str]:
    """
    Verify that migration was successful.

    Returns list of issues found (empty if all OK).
    """
    issues = []

    for step in steps:
        if step.required and not step.destination.exists():
            issues.append(f"Missing destination: {step.destination}")
            continue

        if step.destination.exists():
            try:
                with step.destination.open() as f:
                    json.load(f)
            except json.JSONDecodeError as e:
                issues.append(f"Invalid JSON in {step.destination}: {e}")

    return issues


def main():
    parser = argparse.ArgumentParser(
        description="Migrate configuration files to new directory structure"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--no-cleanup",
        action="store_true",
        help="Don't remove source files after migration"
    )
    parser.add_argument(
        "--no-symlinks",
        action="store_true",
        help="Don't create symlinks for backward compatibility"
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only verify current state, don't migrate"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.dry_run:
        logger.info("=== DRY RUN MODE - No changes will be made ===\n")

    # Get app root and migration steps
    app_root = get_app_root()
    logger.info(f"App root: {app_root}")

    if not app_root.exists():
        logger.error(f"App root directory not found: {app_root}")
        sys.exit(1)

    steps = get_migration_steps(app_root)

    # Verify-only mode
    if args.verify_only:
        logger.info("=== VERIFICATION MODE ===\n")
        issues = verify_migration(steps)
        if issues:
            logger.error("Verification failed:")
            for issue in issues:
                logger.error(f"  - {issue}")
            sys.exit(1)
        else:
            logger.info("All files verified successfully!")
            sys.exit(0)

    # Check preconditions
    logger.info("Checking preconditions...")
    errors = check_preconditions(steps)
    if errors:
        logger.error("Precondition check failed:")
        for error in errors:
            logger.error(f"  - {error}")
        logger.info("\nNote: If files have already been migrated, use --verify-only to check.")
        sys.exit(1)

    # Perform migration
    logger.info("\nMigrating files...")
    migrated_count = 0
    for step in steps:
        try:
            if migrate_file(step, dry_run=args.dry_run):
                migrated_count += 1
        except Exception as e:
            logger.error(f"Failed to migrate {step.description}: {e}")
            sys.exit(1)

    if migrated_count == 0:
        logger.info("\nNo files needed migration - already up to date!")
    else:
        logger.info(f"\nMigrated {migrated_count} file(s)")

    # Cleanup source files
    if not args.no_cleanup and migrated_count > 0:
        logger.info("\nCleaning up source files...")
        cleanup_source_files(steps, dry_run=args.dry_run)

    # Create symlinks
    if not args.no_symlinks and migrated_count > 0:
        logger.info("\nCreating compatibility symlinks...")
        create_symlinks_for_compatibility(steps, dry_run=args.dry_run)

    # Verify
    if not args.dry_run:
        logger.info("\nVerifying migration...")
        issues = verify_migration(steps)
        if issues:
            logger.warning("Verification found issues:")
            for issue in issues:
                logger.warning(f"  - {issue}")
        else:
            logger.info("Migration verified successfully!")

    logger.info("\nMigration complete!")


if __name__ == "__main__":
    main()
