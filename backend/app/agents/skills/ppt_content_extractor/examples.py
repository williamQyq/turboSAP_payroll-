"""
Usage Examples for PPT Content Extractor Agent Skill

Demonstrates various ways to use the PPT content extraction functionality.
"""

from typing import Dict, Any
from app.agents.skills.ppt_content_extractor.get_ppt_content import (
    get_ppt_content,
    extract_ppt_text,
    get_ppt_metadata,
    get_ppt_slides_summary,
    get_ppt_contents_batch,
    create_ppt_content_node,
    create_ppt_router_node,
    get_skill_info,
)


# ============================================
# Example 1: Basic Usage - Get Full Content
# ============================================

def example_basic_extraction():
    """Extract complete content from a PPT file in S3."""
    print("=" * 60)
    print("Example 1: Basic PPT Content Extraction")
    print("=" * 60)

    try:
        # Assuming a PPT file exists at this S3 location
        object_key = "reachnett_ppt/1010/Enterprise_Structure.pptx"

        content = get_ppt_content(object_key)

        print(f"✓ Successfully extracted: {content['file_name']}")
        print(f"  Slides: {content['slide_count']}")
        print(f"  Size: {content['file_size']} bytes")
        print(f"  Title: {content['metadata']['title']}")
        print(f"  Author: {content['metadata']['author']}")
        print("\nFirst 500 characters of text:")
        print(content['full_text'][:500])

        return content

    except Exception as e:
        print(f"✗ Extraction failed: {str(e)}")
        return None


# ============================================
# Example 2: Extract Text Only
# ============================================

def example_text_extraction():
    """Extract only text content from PPT."""
    print("\n" + "=" * 60)
    print("Example 2: Text-Only Extraction")
    print("=" * 60)

    try:
        # First get the full content to have bytes
        object_key = "reachnett_ppt/1010/Enterprise_Structure.pptx"
        content = get_ppt_content(object_key)

        # If you already have the bytes, you can extract just text:
        # from io import BytesIO
        # from pptx import Presentation
        # ppt_bytes = ...  # binary data
        # presentation = Presentation(BytesIO(ppt_bytes))

        print(f"✓ Text extracted from {content['file_name']}")
        print(f"  Total characters: {len(content['full_text'])}")
        print(f"  Total lines: {content['full_text'].count(chr(10))}")
        print("\nFirst 300 characters:")
        print(content['full_text'][:300])

        return content['full_text']

    except Exception as e:
        print(f"✗ Text extraction failed: {str(e)}")
        return None


# ============================================
# Example 3: Get Metadata Only
# ============================================

def example_metadata_extraction():
    """Extract just the metadata from PPT."""
    print("\n" + "=" * 60)
    print("Example 3: Metadata Extraction")
    print("=" * 60)

    try:
        object_key = "reachnett_ppt/1010/Enterprise_Structure.pptx"
        content = get_ppt_content(object_key)
        metadata = content['metadata']

        print("✓ Metadata extracted:")
        for key, value in metadata.items():
            print(f"  {key}: {value}")

        return metadata

    except Exception as e:
        print(f"✗ Metadata extraction failed: {str(e)}")
        return None


# ============================================
# Example 4: Get Slide-by-Slide Summary
# ============================================

def example_slide_summary():
    """Get summary of each slide."""
    print("\n" + "=" * 60)
    print("Example 4: Slide-by-Slide Summary")
    print("=" * 60)

    try:
        object_key = "reachnett_ppt/1010/Enterprise_Structure.pptx"
        content = get_ppt_content(object_key)

        print(f"✓ Processed {content['slide_count']} slides:")
        print()

        for slide in content['slides'][:3]:  # Show first 3 slides
            print(f"Slide {slide['slide_number']}: {slide['title']}")
            print(f"  Elements: {len(slide.get('elements', []))}")
            print(f"  Text preview: {slide['text_content'][:100]}...")
            if slide['speaker_notes']:
                print(f"  Notes: {slide['speaker_notes'][:50]}...")
            print()

        if content['slide_count'] > 3:
            print(f"... and {content['slide_count'] - 3} more slides")

        return content['slides']

    except Exception as e:
        print(f"✗ Slide extraction failed: {str(e)}")
        return None


# ============================================
# Example 5: Batch Processing Multiple Files
# ============================================

def example_batch_processing():
    """Extract content from multiple PPT files."""
    print("\n" + "=" * 60)
    print("Example 5: Batch Processing")
    print("=" * 60)

    try:
        files = [
            "reachnett_ppt/1010/Enterprise_Structure.pptx",
        ]

        results = get_ppt_contents_batch(files)

        print(f"✓ Processed {len(files)} files")
        print()

        for result in results:
            if result.get('success'):
                print(f"✓ {result['file_name']}: {result['slide_count']} slides")
            else:
                print(f"✗ {result['object_key']}: {result['error']}")

        return results

    except Exception as e:
        print(f"✗ Batch processing failed: {str(e)}")
        return None


# ============================================
# Example 6: LangGraph Integration
# ============================================

def example_langgraph_integration():
    """Demonstrate integration with LangGraph."""
    print("\n" + "=" * 60)
    print("Example 6: LangGraph Integration")
    print("=" * 60)

    print("✓ Creating LangGraph nodes...")

    # Create nodes
    ppt_node = create_ppt_content_node()
    router_node = create_ppt_router_node()

    print(f"  - PPT Content Node: {ppt_node.__name__}")
    print(f"  - Router Node: {router_node.__name__}")

    # Example state
    state = {
        "ppt_object_key": "reachnett_ppt/1010/Enterprise_Structure.pptx",
        "other_data": "will be preserved",
    }

    print("\n✓ Example usage in state:")
    print(f"  Input state: {state}")

    # Simulate node execution (won't actually run without real S3 data)
    print("\n  After execution, state would contain:")
    print("    - ppt_content: Dict with full extraction result")
    print("    - ppt_extraction_error: None if successful")

    return (ppt_node, router_node)


# ============================================
# Example 7: Error Handling
# ============================================

def example_error_handling():
    """Demonstrate error handling."""
    print("\n" + "=" * 60)
    print("Example 7: Error Handling")
    print("=" * 60)

    # Example 1: Invalid object key
    print("Scenario 1: Invalid object key format")
    try:
        content = get_ppt_content("invalid_key_format")
    except Exception as e:
        print(f"  Error caught: {type(e).__name__}: {str(e)[:80]}...")

    # Example 2: Nonexistent file
    print("\nScenario 2: File doesn't exist in S3")
    try:
        content = get_ppt_content("acme_corp/1000/nonexistent.pptx")
    except Exception as e:
        print(f"  Error caught: {type(e).__name__}: {str(e)[:80]}...")

    # Example 3: Missing dependency
    print("\nScenario 3: python-pptx not installed")
    print("  Error: PPTContentExtractionError: python-pptx not installed")
    print("  Solution: pip install python-pptx")

    return None


# ============================================
# Example 8: Skill Information
# ============================================

def example_skill_info():
    """Display skill metadata."""
    print("\n" + "=" * 60)
    print("Example 8: Skill Information")
    print("=" * 60)

    info = get_skill_info()

    print(f"Name: {info['name']}")
    print(f"Version: {info['version']}")
    print(f"Description: {info['description']}")
    print(f"\nCapabilities: {', '.join(info['capabilities'])}")
    print(f"Supported formats: {', '.join(info['supported_formats'])}")
    print(f"Dependencies: {', '.join(info['dependencies'])}")
    print(f"Available: {info['availability']}")

    return info


# ============================================
# Example 9: Processing Pipeline
# ============================================

def example_processing_pipeline():
    """Complete pipeline: extract, analyze, and store results."""
    print("\n" + "=" * 60)
    print("Example 9: Complete Processing Pipeline")
    print("=" * 60)

    try:
        object_key = "reachnett_ppt/1010/Enterprise_Structure.pptx"

        print(f"Step 1: Extracting content from {object_key}...")
        content = get_ppt_content(object_key)

        print(f"Step 2: Analyzing extracted data...")
        analysis = {
            "file": content['file_name'],
            "slides": content['slide_count'],
            "total_text_length": len(content['full_text']),
            "avg_text_per_slide": len(content['full_text']) / content['slide_count'],
            "metadata": content['metadata'],
            "slides_summary": [
                {
                    "number": s['slide_number'],
                    "title": s['title'],
                    "text_length": len(s['text_content']),
                }
                for s in content['slides']
            ]
        }

        print(f"Step 3: Storing results...")
        print("  - File processed successfully")
        print(f"  - {content['slide_count']} slides analyzed")
        print(f"  - {len(content['full_text'])} characters extracted")

        return analysis

    except Exception as e:
        print(f"✗ Pipeline failed: {str(e)}")
        return None


# ============================================
# Main: Run All Examples
# ============================================

if __name__ == "__main__":
    print("\n")
    print("╔" + "═" * 58 + "╗")
    print("║" + "PPT Content Extractor - Usage Examples".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    print()

    # Show skill info first
    example_skill_info()

    # Show each example (commented to prevent actual S3 calls)
    print("\n\nNote: The following examples show expected behavior.")
    print("Actual S3 calls are commented out to prevent errors.")
    print("\n")

    example_basic_extraction()
    example_text_extraction()
    example_metadata_extraction()
    example_slide_summary()
    example_batch_processing()
    example_langgraph_integration()
    example_error_handling()
    example_processing_pipeline()

    print("\n" + "═" * 60)
    print("Examples completed!")
    print("═" * 60 + "\n")
