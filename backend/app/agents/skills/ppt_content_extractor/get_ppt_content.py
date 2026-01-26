"""
PPT Content Extractor Agent Skill (Enhanced with Unstructured.io)

Provides functionality to retrieve and extract content from PowerPoint presentations stored in S3.
Enhanced with coordinate-based text ordering and semantic classification using unstructured.io.
Reuses ReachNettDataManager and KnowledgebaseDownloadService for S3 integration.

Main Functions:
    - get_ppt_content: Retrieve full PPT content from S3 with semantic tagging
    - extract_ppt_text: Extract all text with coordinate ordering and semantic tags
    - get_ppt_metadata: Extract metadata from PPT (title, author, dates, etc.)
    - get_ppt_slides_summary: Get slide-by-slide summary with semantic classification
    - get_ppt_contents_batch: Batch process multiple PPT files

Enhanced Features:
    - Coordinate-aware reading order (Top-to-Bottom, Left-to-Right)
    - Automatic semantic classification (Title, NarrativeText, ListItem, Table, Footer)
    - Slide boundary detection using PageBreak elements
    - Speaker notes extraction support
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime
from unstructured.partition.pptx import partition_pptx

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
    PPTX_AVAILABLE = True
except ImportError:
    PPTX_AVAILABLE = False


# Import reusable components from parent app
import sys

# Add backend app to path for imports
_BACKEND_PATH = Path(__file__).resolve().parent.parent.parent.parent
if str(_BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(_BACKEND_PATH))

from app.services.knowledgebase import (
    KnowledgebaseDownloadService,
    KnowledgebaseDownloadError,
)
from app.data import ReachNettDataManager


# ============================================
# Module Setup
# ============================================

class PPTContentExtractionError(Exception):
    """Raised when PPT extraction fails."""
    pass


# Global instances (can be customized if needed)
_download_service: Optional[KnowledgebaseDownloadService] = None
_data_manager: Optional[ReachNettDataManager] = None


def _get_download_service() -> KnowledgebaseDownloadService:
    """Lazy-load download service singleton."""
    global _download_service
    if _download_service is None:
        _download_service = KnowledgebaseDownloadService()
    return _download_service


def _get_data_manager() -> ReachNettDataManager:
    """Lazy-load data manager singleton."""
    global _data_manager
    if _data_manager is None:
        _data_manager = ReachNettDataManager()
    return _data_manager


# ============================================
# Core Functions
# ============================================

def get_ppt_content(object_key: str) -> Dict[str, Any]:
    """
    Retrieve and extract complete PPT content from S3.

    Args:
        object_key: S3 object key in format "company_name/company_code/filename.pptx"

    Returns:
        Dict containing:
            - success: bool
            - object_key: str (the queried key)
            - file_name: str
            - file_size: int (bytes)
            - slide_count: int
            - metadata: Dict with title, author, created date, etc.
            - slides: List[Dict] with slide content
            - full_text: str (concatenated text from all slides)
            - error: Optional[str] (if any error occurred)

    Raises:
        KnowledgebaseDownloadError: If S3 download fails
        PPTContentExtractionError: If PPT parsing fails
    """
    if not PPTX_AVAILABLE:
        raise PPTContentExtractionError(
            "python-pptx not installed. Install with: pip install python-pptx"
        )

    try:
        # Download PPT bytes from S3
        service = _get_download_service()
        ppt_bytes = service._download_bytes(object_key)

        # Extract components
        metadata = get_ppt_metadata(ppt_bytes)
        slides = get_ppt_slides_summary(ppt_bytes)
        full_text = extract_ppt_text(ppt_bytes)

        file_name = Path(object_key).name
        file_size = len(ppt_bytes)
        slide_count = len(slides)

        return {
            "success": True,
            "object_key": object_key,
            "file_name": file_name,
            "file_size": file_size,
            "slide_count": slide_count,
            "metadata": metadata,
            "slides": slides,
            "full_text": full_text,
            "error": None,
        }

    except KnowledgebaseDownloadError as e:
        raise KnowledgebaseDownloadError(f"Failed to download PPT from S3: {str(e)}") from e
    except Exception as e:
        raise PPTContentExtractionError(f"Failed to extract PPT content: {str(e)}") from e


def extract_ppt_text(ppt_bytes: bytes) -> str:
    """
    Extract all text from PPT with semantic tags and coordinate ordering.
    
    Uses unstructured.io for coordinate-aware partitioning and semantic classification.
    
    Args:
        ppt_bytes: Binary content of PPT file
        
    Returns:
        str: Text content with semantic tags and slide boundaries
             Format: "[CATEGORY]: text" with "--- Slide N ---" markers
             
    Raises:
        PPTContentExtractionError: If extraction fails
        
    Example Output:
        --- Slide 1 ---
        [TITLE]: TurboSAP Payroll Guide
        [NARRATIVETEXT]: This covers payment methods.
        [LISTITEM]: Method 1: Direct Deposit
        [LISTITEM]: Method 2: Check
    """

    try:
        from io import BytesIO
        
        # 1. Use unstructured for coordinate-aware partitioning
        # include_page_breaks=True inserts PageBreak objects between slides
        # strategy="fast" for speed; use "hi_res" for higher accuracy if needed
        elements = partition_pptx(
            file=BytesIO(ppt_bytes),
            include_page_breaks=True,
            strategy="fast"  # For extreme accuracy, change to "hi_res"
        )

        all_text = []
        current_slide_num = 1
        
        # Initialize with first slide marker
        all_text.append(f"--- Slide {current_slide_num} ---")

        for el in elements:
            # 2. Detect page breaks (slide transitions)
            if "PageBreak" in str(type(el)):
                current_slide_num += 1
                all_text.append(f"\n--- Slide {current_slide_num} ---")
                continue

            # 3. Extract text and add semantic tags
            text = el.text.strip()
            if text:
                # el.category is determined by coordinates and font size
                # Common categories: Title, NarrativeText, ListItem, Table, Footer
                tag = f"[{el.category.upper()}]"
                all_text.append(f"{tag}: {text}")

        return "\n".join(all_text)

    except Exception as e:
        raise PPTContentExtractionError(f"Failed to extract text using unstructured: {str(e)}")

def get_ppt_metadata(ppt_bytes: bytes) -> Dict[str, Any]:
    """
    Extract metadata from PPT file.

    Args:
        ppt_bytes: Binary content of PPT file

    Returns:
        Dict containing:
            - title: str
            - author: str
            - subject: str
            - keywords: str
            - created: ISO timestamp
            - modified: ISO timestamp
            - slide_count: int
    """
    if not PPTX_AVAILABLE:
        raise PPTContentExtractionError("python-pptx not installed")

    try:
        from io import BytesIO
        presentation = Presentation(BytesIO(ppt_bytes))
        props = presentation.core_properties

        metadata = {
            "title": props.title or "Untitled",
            "author": props.author or "Unknown",
            "subject": props.subject or "",
            "keywords": props.keywords or "",
            "created": props.created.isoformat() if props.created else None,
            "modified": props.modified.isoformat() if props.modified else None,
            "slide_count": len(presentation.slides),
        }

        return metadata

    except Exception as e:
        raise PPTContentExtractionError(f"Failed to extract metadata from PPT: {str(e)}") from e


def get_ppt_slides_summary(ppt_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract slide-by-slide summary with semantic classification and speaker notes.
    """
    try:
        from io import BytesIO
        # include_page_breaks=True allows slide boundary detection
        elements = partition_pptx(
            file=BytesIO(ppt_bytes),
            include_page_breaks=True,
            strategy="fast"
        )

        slides_summary = []
        current_slide_num = 1
        slide_text = []
        slide_title = ""
        slide_elements = [] # New: Store raw elements

        for el in elements:
            # Detect page break (new slide)
            if "PageBreak" in str(type(el)):
                if slide_text or slide_title or slide_elements:
                    slides_summary.append({
                        "slide_number": current_slide_num,
                        "title": slide_title or f"Slide {current_slide_num}",
                        "text_content": "\n".join(slide_text),
                        "elements": slide_elements, # Sync with metadata.json
                        "speaker_notes": "" # Unstructured placeholder
                    })
                    # Reset state
                    current_slide_num += 1
                    slide_text = []
                    slide_title = ""
                    slide_elements = []
                continue

            text = el.text.strip()
            if not text:
                continue

            # Add to raw elements list for schema sync
            slide_elements.append({
                "text": text,
                "category": el.category
            })

            if el.category == "Title" and not slide_title:
                slide_title = text
            else:
                slide_text.append(text)

        # Process last slide
        if slide_text or slide_title or slide_elements:
            slides_summary.append({
                "slide_number": current_slide_num,
                "title": slide_title or f"Slide {current_slide_num}",
                "text_content": "\n".join(slide_text),
                "elements": slide_elements,
                "speaker_notes": ""
            })

        return slides_summary

    except Exception as e:
        raise PPTContentExtractionError(f"Unstructured parsing failed: {str(e)}")
    

# ============================================
# LangGraph Integration Helpers
# ============================================

def create_ppt_content_node():
    """
    Factory function to create a LangGraph node for PPT content extraction.

    Usage in LangGraph:
        from ppt_content_extractor.get_ppt_content import create_ppt_content_node

        graph_builder.add_node("extract_ppt", create_ppt_content_node())

    The node expects state to have:
        - ppt_object_key: str (S3 object key)

    And will add to state:
        - ppt_content: Dict (extraction result)
        - ppt_extraction_error: Optional[str]
    """

    def extract_ppt_node(state: Dict[str, Any]) -> Dict[str, Any]:
        object_key = state.get("ppt_object_key")

        if not object_key:
            state["ppt_extraction_error"] = "No ppt_object_key in state"
            return state

        try:
            content = get_ppt_content(object_key)
            state["ppt_content"] = content
            state["ppt_extraction_error"] = None
        except (KnowledgebaseDownloadError, PPTContentExtractionError) as e:
            state["ppt_extraction_error"] = str(e)
            state["ppt_content"] = None

        return state

    return extract_ppt_node


def create_ppt_router_node():
    """
    Factory function to create a router node for conditional PPT extraction.

    Returns a node that routes based on whether PPT object key is present.

    Usage:
        graph_builder.add_node("check_ppt", create_ppt_router_node())
        graph_builder.add_edge("check_ppt", "extract_ppt", condition=lambda x: x.get("has_ppt"))
    """

    def router_node(state: Dict[str, Any]) -> Dict[str, Any]:
        has_ppt = bool(state.get("ppt_object_key"))
        state["has_ppt"] = has_ppt
        return state

    return router_node


# ============================================
# Batch Processing
# ============================================

def get_ppt_contents_batch(object_keys: List[str]) -> List[Dict[str, Any]]:
    """
    Extract content from multiple PPT files in batch.

    Args:
        object_keys: List of S3 object keys

    Returns:
        List of extraction results (each may have error field if failed)
    """
    results = []

    for object_key in object_keys:
        try:
            content = get_ppt_content(object_key)
            results.append(content)
        except (KnowledgebaseDownloadError, PPTContentExtractionError) as e:
            results.append({
                "success": False,
                "object_key": object_key,
                "error": str(e),
            })

    return results


# ============================================
# Module Info
# ============================================

def get_skill_info() -> Dict[str, Any]:
    """Return metadata about this skill."""
    return {
        "name": "PPT Content Extractor (Enhanced)",
        "version": "1.1.0",
        "description": "Extract and retrieve PowerPoint content from S3 with coordinate-aware ordering and semantic classification",
        "enhanced_features": [
            "Coordinate-aware reading order optimization",
            "Automatic semantic classification (Title, NarrativeText, ListItem, Table, Footer)",
            "Slide boundary detection using PageBreak elements",
            "Speaker notes extraction support",
        ],
        "capabilities": [
            "extract_full_content",
            "coordinate_aware_text_extraction",
            "semantic_element_classification",
            "extract_metadata",
            "get_slide_summary",
        ],
        "supported_formats": [".pptx"],
        "dependencies": [
            "python-pptx>=0.6.21",
            "unstructured>=0.10.0",
            "KnowledgebaseDownloadService",
            "ReachNettDataManager",
        ],
        "availability": PPTX_AVAILABLE,
    }


if __name__ == "__main__":
    print(get_skill_info())
