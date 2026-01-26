"""
PPT Content Extractor Agent Skill Package

This skill provides reusable functionality for extracting PowerPoint content from S3.
It integrates with the existing ReachNett data infrastructure.

Quick Start:
    from ppt_content_extractor import get_ppt_content
    
    content = get_ppt_content("company_name/company_code/file.pptx")
    print(content['slides'])
"""

from .get_ppt_content import (
    get_ppt_content,
    extract_ppt_text,
    get_ppt_metadata,
    get_ppt_slides_summary,
    get_ppt_contents_batch,
    create_ppt_content_node,
    create_ppt_router_node,
    get_skill_info,
    PPTContentExtractionError,
)

__all__ = [
    "get_ppt_content",
    "extract_ppt_text",
    "get_ppt_metadata",
    "get_ppt_slides_summary",
    "get_ppt_contents_batch",
    "create_ppt_content_node",
    "create_ppt_router_node",
    "get_skill_info",
    "PPTContentExtractionError",
]

__version__ = "1.0.0"
__author__ = "TurboSAP Team"
