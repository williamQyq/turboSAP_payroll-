"""
Module Configuration Routes

Unified API for managing module question configurations.
Supports multiple modules with different file paths and validation rules.

Endpoints:
- GET  /api/config/modules                      - List all available modules
- GET  /api/config/modules/{slug}               - Get module metadata
- PUT  /api/config/modules/{slug}               - Update module metadata (admin only)
- GET  /api/config/modules/{slug}/questions     - Get module questions
- PUT  /api/config/modules/{slug}/questions     - Update module questions (admin only)
- POST /api/config/modules/{slug}/questions/restore - Restore from backup (admin only)
"""

import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException

from ..middleware import get_current_user, require_admin
from ..services.config_store import config_store, ConfigStoreError
from ..services.question_validator import validate_questions_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config/modules", tags=["Module Config"])

# Base paths
APP_DIR = Path(__file__).parent.parent
CONFIG_DIR = APP_DIR / "config"
DATA_DIR = APP_DIR / "data"

# New paths (post-migration)
MODULES_DIR = DATA_DIR / "modules"
METADATA_DIR = DATA_DIR / "metadata"

# Metadata paths - check new location first, fall back to old
def _get_modules_metadata_path() -> Path:
    """Get the modules metadata path, supporting both old and new locations."""
    new_path = METADATA_DIR / "modules.json"
    old_path = DATA_DIR / "modules_metadata.json"
    if new_path.exists():
        return new_path
    return old_path

MODULES_METADATA_PATH = _get_modules_metadata_path()


def _get_module_paths(slug: str) -> dict:
    """
    Get file paths for a module, supporting both old and new locations.

    Returns dict with 'current', 'backup', 'original' paths.
    Checks new locations first, falls back to old locations.
    """
    # New paths (post-migration structure)
    new_paths = {
        "payment-methods": {
            "current": MODULES_DIR / "payment-methods" / "questions.json",
            "backup": MODULES_DIR / "payment-methods" / "questions_backup.json",
            "original": None,
        },
        "payroll-area": {
            "current": MODULES_DIR / "payroll-area" / "questions.json",
            "backup": MODULES_DIR / "payroll-area" / "questions_backup.json",
            "original": MODULES_DIR / "payroll-area" / "questions_original.json",
        },
    }

    # Old paths (legacy structure)
    old_paths = {
        "payment-method": {
            "current": DATA_DIR / "payment_method_questions.json",
            "backup": DATA_DIR / "payment_method_questions_backup.json",
            "original": None,
        },
        "payroll-area": {
            "current": CONFIG_DIR / "questions_current.json",
            "backup": CONFIG_DIR / "questions_backup.json",
            "original": CONFIG_DIR / "questions_original.json",
        },
    }

    # Normalize slug (payment-method and payment-methods are the same)
    normalized_slug = slug
    if slug == "payment-method":
        normalized_slug = "payment-methods"

    # Check new paths first
    if normalized_slug in new_paths:
        new = new_paths[normalized_slug]
        if new["current"].exists():
            return new

    # Fall back to old paths
    # Try with original slug first
    if slug in old_paths:
        old = old_paths[slug]
        if old["current"].exists():
            return old

    # For custom modules, use new structure
    module_dir = MODULES_DIR / slug
    return {
        "current": module_dir / "questions.json",
        "backup": module_dir / "questions_backup.json",
        "original": None,
    }


# File paths registry - maps slugs to question file locations
# This is kept for backward compatibility but now uses _get_module_paths()
# Separate from metadata (name/description) which is stored in modules_metadata.json
MODULE_FILES = {
    "payment-method": _get_module_paths("payment-method"),
    "payroll-area": _get_module_paths("payroll-area"),
}

def _load_modules_metadata() -> Dict[str, Any]:
    """Load module metadata from JSON file."""
    base = {"version": "1.0", "modules": {}, "categories": {}}

    # Try new location first, fall back to old
    metadata_path = _get_modules_metadata_path()

    if not metadata_path.exists():
        return base
    try:
        with metadata_path.open() as f:
            data = json.load(f)
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON in modules metadata file: {metadata_path}")
        return base

    # Ensure expected top-level keys exist
    if "modules" not in data:
        data["modules"] = {}
    if "categories" not in data:
        data["categories"] = {}
    if "version" not in data:
        data["version"] = "1.0"
    return data


def _save_modules_metadata(data: Dict[str, Any]) -> None:
    """Save module metadata to JSON file."""
    # Get current metadata path (prefers new location if it exists)
    metadata_path = _get_modules_metadata_path()
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    with metadata_path.open("w") as f:
        json.dump(data, f, indent=2)


def _get_module_metadata(slug: str) -> Dict[str, Any]:
    """Get metadata for a specific module."""
    metadata = _load_modules_metadata()
    modules = metadata.get("modules", {})

    if slug not in modules and slug not in MODULE_FILES:
        available = ", ".join(set(modules.keys()) | set(MODULE_FILES.keys()))
        raise HTTPException(
            status_code=404,
            detail=f"Module '{slug}' not found. Available modules: {available}"
        )

    # Return metadata or defaults
    return modules.get(slug, {
        "name": slug.replace("-", " ").title(),
        "description": "",
        "icon": "settings",
        "status": "active",
        "order": 999
    })


def _validate_questions_schema(data: Dict[str, Any], module_slug: str) -> None:
    """
    Validate the questions schema.

    Raises HTTPException if validation fails.
    """
    if "questions" not in data:
        raise HTTPException(status_code=400, detail="Payload must contain 'questions' array")

    if not isinstance(data["questions"], list):
        raise HTTPException(status_code=400, detail="'questions' must be an array")

    seen_ids: set[str] = set()

    for i, q in enumerate(data["questions"]):
        if not isinstance(q, dict):
            raise HTTPException(status_code=400, detail=f"Question {i+1} must be an object")

        qid = q.get("id")
        text = q.get("text")
        qtype = q.get("type")

        # Required fields
        if not qid or not isinstance(qid, str):
            raise HTTPException(status_code=400, detail=f"Question {i+1} is missing 'id'")
        if not text or not isinstance(text, str):
            raise HTTPException(status_code=400, detail=f"Question '{qid}' is missing 'text'")
        if not qtype or not isinstance(qtype, str):
            raise HTTPException(status_code=400, detail=f"Question '{qid}' is missing 'type'")

        # Check for duplicate IDs
        if qid in seen_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate question id: {qid}")
        seen_ids.add(qid)

        # Validate options for choice-type questions
        if qtype in ["multiple_choice", "choice", "multiple_select"]:
            options = q.get("options")
            if options is not None:
                if not isinstance(options, list):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{qid}' options must be an array"
                    )
                for j, opt in enumerate(options):
                    if not isinstance(opt, dict):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Question '{qid}', option {j+1} must be an object"
                        )
                    if not opt.get("id"):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Question '{qid}', option {j+1} is missing 'id'"
                        )
                    if not opt.get("label"):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Question '{qid}', option {j+1} is missing 'label'"
                        )

        # Validate spreadsheetConfig for spreadsheet-type questions
        if qtype == "spreadsheet":
            spreadsheet_config = q.get("spreadsheetConfig")
            if not spreadsheet_config or not isinstance(spreadsheet_config, dict):
                raise HTTPException(
                    status_code=400,
                    detail=f"Question '{qid}' (spreadsheet type) requires 'spreadsheetConfig'"
                )
            columns = spreadsheet_config.get("columns")
            if not columns or not isinstance(columns, list) or len(columns) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Question '{qid}' spreadsheetConfig must have at least one column"
                )
            seen_keys = set()
            for j, col in enumerate(columns):
                if not isinstance(col, dict):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{qid}', column {j+1} must be an object"
                    )
                col_key = col.get("key")
                if not col_key:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{qid}', column {j+1} missing 'key'"
                    )
                if col_key in seen_keys:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{qid}' has duplicate column key '{col_key}'"
                    )
                seen_keys.add(col_key)
                if not col.get("label"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Question '{qid}', column {j+1} missing 'label'"
                    )


def _get_module_files(slug: str) -> dict:
    """Get module file paths or raise 404."""
    # Get paths using the helper that supports old and new locations
    paths = _get_module_paths(slug)

    # If the current file exists, return the paths
    if paths["current"].exists():
        # Cache in MODULE_FILES for this session
        MODULE_FILES[slug] = paths
        return paths

    # Check if it's in MODULE_FILES already (for built-in modules)
    if slug in MODULE_FILES:
        cached = MODULE_FILES[slug]
        if cached["current"].exists():
            return cached

    # If not in MODULE_FILES, check if it's a custom module in metadata
    metadata = _load_modules_metadata()
    if slug in metadata.get("modules", {}):
        # Create file paths for custom module using new structure
        module_dir = MODULES_DIR / slug
        module_dir.mkdir(parents=True, exist_ok=True)

        # Define file paths for the custom module
        files = {
            "current": module_dir / "questions.json",
            "backup": module_dir / "questions_backup.json",
            "original": None
        }

        # Add to MODULE_FILES for this session
        MODULE_FILES[slug] = files
        return files

    # If we get here, the module doesn't exist
    available = ", ".join(MODULE_FILES.keys())
    raise HTTPException(
        status_code=404,
        detail=f"Module '{slug}' not found. Available modules: {available}"
    )


def _read_json(path: Path) -> Dict[str, Any]:
    """Read JSON file or raise appropriate error."""
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Configuration file not found")
    try:
        with path.open() as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in configuration file: {e}")


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    """Write JSON file, creating parent directories if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(data, f, indent=2)


# ============================================
# Endpoints
# ============================================

''''
@router.get("")
async def list_modules(current_user: dict = Depends(get_current_user)):
    """
    List all available modules and their configuration status.
    Combines metadata from JSON with file status from registry.
    """
    #try: 
    all_metadata = _load_modules_metadata()
    modules_data = all_metadata.get("modules", {})

    modules = []
    # Get all unique slugs from both metadata and file registry
    all_slugs = set(modules_data.keys()) | set(MODULE_FILES.keys())

    for slug in sorted(all_slugs, key=lambda s: modules_data.get(s, {}).get("order", 999)):
        meta = _get_module_metadata(slug)
        files = MODULE_FILES.get(slug, {})

        module_info = {
            "slug": slug,
            "name": meta.get("name", slug.replace("-", " ").title()),
            "description": meta.get("description", ""),
            "icon": meta.get("icon", "settings"),
            "status": meta.get("status", "active"),
            "order": meta.get("order", 999),
            "hasConfig": files.get("current") and files["current"].exists() if files else False,
            "hasBackup": files.get("backup") and files["backup"].exists() if files else False,
            "hasOriginal": files.get("original") and files["original"].exists() if files else False,
        }
        modules.append(module_info)

    return {"modules": modules}
    #except Exception as e:
        #raise HTTPException(status_code=500, detail=f"Error loading modules: {str(e)}")
'''

@router.get("", response_model=Dict[str, Any])
async def list_modules(current_user: dict = Depends(get_current_user)):
    """List all available modules and their configuration status."""
    metadata = _load_modules_metadata()
    modules_metadata = metadata.get("modules", {})
    
    result = {"modules": []}
    all_module_slugs = set(MODULE_FILES.keys()).union(modules_metadata.keys())
    
    for slug in all_module_slugs:
        try:
            files = _get_module_files(slug)
            module_info = {
                "slug": slug,
                "hasConfig": files["current"].exists() if files["current"] else False,
                "hasBackup": files["backup"].exists() if files["backup"] else False,
                "hasOriginal": files["original"].exists() if files["original"] else False,
            }
            
            # Add metadata if available
            if slug in modules_metadata:
                module_info.update(modules_metadata[slug])
                
            result["modules"].append(module_info)
        except HTTPException:
            continue
    
    # Sort modules by order if available, otherwise by name
    result["modules"].sort(key=lambda x: (x.get("order", 999), x.get("name", "")))
    
    return result


@router.get("/{module_slug}", response_model=None)
async def get_module_metadata(
    module_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get metadata for a specific module (name, description, icon, etc.)
    """
    meta = _get_module_metadata(module_slug)
    files = MODULE_FILES.get(module_slug, {})

    return {
        "slug": module_slug,
        "name": meta.get("name", module_slug.replace("-", " ").title()),
        "description": meta.get("description", ""),
        "icon": meta.get("icon", "settings"),
        "status": meta.get("status", "active"),
        "order": meta.get("order", 999),
        "hasConfig": files.get("current") and files["current"].exists() if files else False,
        "hasBackup": files.get("backup") and files["backup"].exists() if files else False,
        "hasOriginal": files.get("original") and files["original"].exists() if files else False,
    }


@router.put("/{module_slug}", response_model=None)
async def update_module_metadata(
    module_slug: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update metadata for a specific module (name, description). Admin only.
    """
    # Validate the module exists
    if module_slug not in MODULE_FILES:
        all_metadata = _load_modules_metadata()
        if module_slug not in all_metadata.get("modules", {}):
            raise HTTPException(status_code=404, detail=f"Module '{module_slug}' not found")

    # Load current metadata
    all_metadata = _load_modules_metadata()
    if "modules" not in all_metadata:
        all_metadata["modules"] = {}

    # Get existing or create new
    current = all_metadata["modules"].get(module_slug, {})

    # Update allowed fields
    if "name" in payload:
        current["name"] = str(payload["name"]).strip()
    if "description" in payload:
        current["description"] = str(payload["description"]).strip()
    if "icon" in payload:
        current["icon"] = str(payload["icon"]).strip()
    if "status" in payload and payload["status"] in ["active", "inactive", "draft"]:
        current["status"] = payload["status"]
    if "order" in payload:
        current["order"] = int(payload["order"])

    if "categorySlug" in payload:
        # Optional: validate against categories
        all_metadata = _load_modules_metadata()
        categories = all_metadata.get("categories", {})
        cat = str(payload["categorySlug"]).strip()
        if not cat:
            raise HTTPException(
                status_code=400,
                detail="categorySlug is required and cannot be empty"
            )
        if cat not in categories:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid categorySlug '{cat}'"
            )

    current["categorySlug"] = cat

    # Save
    all_metadata["modules"][module_slug] = current
    _save_modules_metadata(all_metadata)

    return {
        "status": "ok",
        "message": f"Module '{module_slug}' metadata updated",
        "module": {
            "slug": module_slug,
            **current
        }
    }


@router.get("/{module_slug}/questions")
async def get_module_questions(
    module_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current questions configuration for a module.
    """
    files = _get_module_files(module_slug)
    meta = _get_module_metadata(module_slug)
    data = _read_json(files["current"])

    # Add metadata
    data["_meta"] = {
        "module": module_slug,
        "moduleName": meta.get("name", module_slug.replace("-", " ").title()),
        "moduleDescription": meta.get("description", ""),
        "hasBackup": files["backup"].exists() if files["backup"] else False,
        "hasOriginal": files["original"].exists() if files["original"] else False,
    }

    return data


@router.put("/{module_slug}/questions")
async def update_module_questions(
    module_slug: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update the questions configuration for a module. Admin only.

    Creates a backup of the current file before saving.
    Validates that the payload has the required structure.
    """
    files = _get_module_files(module_slug)
    meta = _get_module_metadata(module_slug)

    # Remove metadata if present (frontend might send it back)
    payload.pop("_meta", None)

    # Validate schema (blocking validation)
    _validate_questions_schema(payload, module_slug)

    # Run additional validation (non-blocking - logs warnings only)
    validation_result = validate_questions_config(payload, module_slug)
    if validation_result.warnings:
        for warning in validation_result.warnings:
            logger.warning(warning)
    if validation_result.errors:
        # Log errors but don't block (for backward compatibility)
        for error in validation_result.errors:
            logger.error(f"Validation error (non-blocking): {error}")

    try:
        # Create backup of current file if it exists
        if files["current"].exists() and files["backup"]:
            shutil.copy(files["current"], files["backup"])

        # Ensure version is preserved or set
        if "version" not in payload:
            payload["version"] = "1.0"

        # Save new configuration
        _write_json(files["current"], payload)

        module_name = meta.get("name", module_slug.replace("-", " ").title())
        return {
            "status": "ok",
            "message": f"{module_name} configuration updated successfully",
            "questionCount": len(payload.get("questions", []))
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {str(e)}")


@router.post("/{module_slug}/questions/restore")
async def restore_module_questions(
    module_slug: str,
    source: str = "backup",  # "backup" or "original"
    current_user: dict = Depends(require_admin),
):
    """
    Restore questions configuration from backup or original. Admin only.

    Query params:
        source: "backup" (default) or "original"
    """
    files = _get_module_files(module_slug)
    meta = _get_module_metadata(module_slug)

    if source == "original":
        if not files["original"]:
            raise HTTPException(
                status_code=400,
                detail=f"Module '{module_slug}' does not have an original file"
            )
        source_path = files["original"]
        source_name = "original"
    else:
        if not files["backup"]:
            raise HTTPException(
                status_code=400,
                detail=f"Module '{module_slug}' does not have a backup file"
            )
        source_path = files["backup"]
        source_name = "backup"

    if not source_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No {source_name} file found for module '{module_slug}'"
        )

    try:
        # Read and validate source
        data = _read_json(source_path)
        _validate_questions_schema(data, module_slug)

        # Save to current
        _write_json(files["current"], data)

        module_name = meta.get("name", module_slug.replace("-", " ").title())
        return {
            "status": "ok",
            "message": f"{module_name} configuration restored from {source_name}",
            "questionCount": len(data.get("questions", []))
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore: {str(e)}")


@router.get("/{module_slug}/questions/original")
async def get_module_original_questions(
    module_slug: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the original (default) questions configuration for a module.
    Only available for modules that have an original file.
    """
    files = _get_module_files(module_slug)

    if not files["original"]:
        raise HTTPException(
            status_code=400,
            detail=f"Module '{module_slug}' does not have an original configuration"
        )

    if not files["original"].exists():
        raise HTTPException(
            status_code=404,
            detail=f"Original configuration file not found for module '{module_slug}'"
        )

    return _read_json(files["original"])

@router.post("", status_code=201)
async def create_module(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Create a new module.
    
    Required fields:
    - name: Display name of the module
    - slug: URL-friendly identifier (auto-generated if not provided)
    - description: Brief description of the module
    - icon: Icon identifier for the module
    - order: Display order (optional)
    """
    try:
        # Load existing modules
        modules_metadata = _load_modules_metadata()
        all_modules = modules_metadata.get("modules", {})
        all_categories = modules_metadata.get("categories", {})
        
        
        # Generate slug if not provided
        slug = payload.get('slug', '').strip() or payload['name'].lower().replace(' ', '-')
        
        # Check if module with this slug already exists
        if slug in all_modules:
            raise HTTPException(
                status_code=400,
                detail=f"Module with slug '{slug}' already exists"
            )
            
        # Validate required fields
        required_fields = ['name']
        for field in required_fields:
            if not payload.get(field):
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: {field}"
                )
        
        # Validate categorySlug
        category_slug = payload.get("categorySlug")
        if category_slug not in all_categories:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid categorySlug '{category_slug}'. "
                    f"Valid categories: {', '.join(all_categories.keys()) or 'none defined'}"
                )
            )  

        # Add default values for optional fields
        if 'description' not in payload:
            payload['description'] = ''
        if 'icon' not in payload:
            payload['icon'] = 'default'
        if 'order' not in payload:
            # Set order to be after the last module
            all_orders = [m.get('order', 0) for m in all_modules.values()]
            payload['order'] = max(all_orders) + 1 if all_orders else 1
        
        # Create module directory (use new structure under modules/)
        module_dir = MODULES_DIR / slug
        module_dir.mkdir(exist_ok=True, parents=True)
        
        # Create new module metadata
        new_module = {
            'slug': slug,
            'name': payload['name'],
            'description': payload['description'],
            'icon': payload['icon'],
            'order': payload['order'],
            'categorySlug': category_slug,
            'createdAt': datetime.now().isoformat(),
            'createdBy': current_user.get('email', 'system'),
            'hasConfig': False,
            'hasBackup': False,
            'hasOriginal': False
        }
        
        # Add to modules metadata
        if "modules" not in modules_metadata:
            modules_metadata["modules"] = {}
        modules_metadata["modules"][slug] = new_module
        _save_modules_metadata(modules_metadata)
        
        # Create default questions file
        questions_path = module_dir / "questions.json"
        default_questions = {
            "version": "1.0",
            "questions": [],
            "metadata": {
                "createdAt": datetime.now().isoformat(),
                "createdBy": current_user.get('email', 'system'),
                "lastModified": datetime.now().isoformat()
            }
        }
        _write_json(questions_path, default_questions)
        
        # Update MODULE_FILES in memory
        MODULE_FILES[slug] = {
            "current": questions_path,
            "backup": module_dir / "questions_backup.json",
            "original": None
        }
        
        return {
            "success": True,
            "module": new_module
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up if there was an error
        if 'module_dir' in locals() and module_dir.exists():
            import shutil
            shutil.rmtree(module_dir, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create module: {str(e)}"
        )

@router.delete("/{module_slug}", response_model=Dict[str, Any])
async def delete_module(
    module_slug: str,
    current_user: dict = Depends(require_admin),
):
    """
    Delete a module and its associated files.
    """
    try:
        # Load metadata
        metadata = _load_modules_metadata()
        modules_metadata = metadata.get("modules", {})
        
        # Check if module exists
        if module_slug not in modules_metadata:
            raise HTTPException(
                status_code=404,
                detail=f"Module '{module_slug}' not found"
            )
        
        # Don't allow deleting pre-made modules
        if module_slug in MODULE_FILES and module_slug in ["payment-method", "payroll-area"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete pre-made modules"
            )
        
        # Get module files
        try:
            files = _get_module_files(module_slug)
            
            # Remove module files
            for file_type, file_path in files.items():
                if file_path and file_path.exists():
                    if file_path.is_file():
                        file_path.unlink()
                    elif file_path.is_dir():
                        shutil.rmtree(file_path)
            
            # Remove from MODULE_FILES if it exists there
            if module_slug in MODULE_FILES:
                del MODULE_FILES[module_slug]
                
        except HTTPException:
            # If files don't exist, just continue with metadata removal
            pass
        
        # Remove from metadata
        del modules_metadata[module_slug]
        _save_modules_metadata(metadata)
        
        return {
            "success": True,
            "message": f"Module '{module_slug}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete module: {str(e)}"
        )

@router.put("/reorder/", response_model=Dict[str, Any])
async def reorder_modules(
    order_data: Dict[str, List[Dict[str, Any]]] = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Reorder modules based on the provided order.
    Expected payload: {"order": [{"slug": "module1", "order": 1}, ...]}
    """
    print("Reorder endpoint hit!")  # Debug log
    print("Received data:", order_data)  # Debug log
    
    try:
        metadata = _load_modules_metadata()
        modules_metadata = metadata.get("modules", {})
        
        print("Current metadata:", modules_metadata)  # Debug log
        
        # Update order for each module
        for item in order_data.get("order", []):
            slug = item.get("slug")
            if slug in modules_metadata:
                modules_metadata[slug]["order"] = item.get("order", 0)
        
        _save_modules_metadata(metadata)
        
        print("Updated metadata:", modules_metadata)  # Debug log
        
        return {
            "success": True,
            "message": "Module order updated successfully"
        }
        
    except Exception as e:
        print("Error in reorder_modules:", str(e))  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update module order: {str(e)}"
        )

@router.get("/debug/routes", include_in_schema=False)
async def debug_routes():
    routes = []
    for route in router.routes:
        routes.append({
            "path": route.path,
            "name": route.name,
            "methods": list(route.methods) if hasattr(route, "methods") else []
        })
    return {"routes": routes}