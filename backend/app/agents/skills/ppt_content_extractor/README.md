# PPT Content Extractor - Enhanced Skill

**Version**: 1.1.0  
**Status**: Production Ready  
**Last Updated**: January 24, 2026

## Overview

The PPT Content Extractor is an advanced agent skill for extracting and retrieving PowerPoint presentation content from AWS S3. It combines **unstructured.io** for coordinate-based text ordering and semantic classification with **python-pptx** for metadata extraction.

## Key Features

✨ **Smart Text Extraction**
- Coordinate-aware reading order optimization (Top-to-Bottom, Left-to-Right)
- Automatic semantic classification (Title, NarrativeText, ListItem, Table, Footer)
- Slide boundary detection using PageBreak elements
- Preserves document structure and hierarchy

✨ **Semantic Classification**
- **Title**: Slide titles and headings
- **NarrativeText**: Body text and paragraphs
- **ListItem**: Bulleted or numbered list items
- **Table**: Table content and data
- **Footer**: Footer text and page numbers

✨ **Rich Metadata Extraction**
- Document title, author, subject, keywords
- Creation and modification timestamps
- Slide count and per-slide summaries
- Speaker notes support

✨ **Enterprise Integration**
- Native LangGraph node factories for workflow integration
- Batch processing for multiple files
- S3 integration via KnowledgebaseDownloadService
- Robust error handling with custom exceptions

## Dependencies

```
python-pptx>=0.6.21        # PPT file structure and metadata
unstructured>=0.10.0       # Coordinate-based partitioning & semantic classification
```

## Installation

```bash
# Install the package
pip install python-pptx>=0.6.21 unstructured>=0.10.0

# Or use the backend requirements
cd backend
pip install -r requirements.txt
```

## Quick Start

### 1. Basic Usage

```python
from app.agents.skills.ppt_content_extractor import get_ppt_content

# Extract full content from S3
content = get_ppt_content("company_name/company_code/presentation.pptx")

print(f"Title: {content['metadata']['title']}")
print(f"Slides: {content['slide_count']}")
print(f"Author: {content['metadata']['author']}")
```

### 2. Extract with Semantic Tags

```python
from app.agents.skills.ppt_content_extractor import extract_ppt_text

# Get text with semantic tags and proper reading order
content = get_ppt_content("company/code/file.pptx")
text = content['full_text']

# Output example:
# --- Slide 1 ---
# [TITLE]: TurboSAP Payroll Guide
# [NARRATIVETEXT]: This covers payment methods and setup.
# [LISTITEM]: Method 1: Direct Deposit
# [LISTITEM]: Method 2: Check
```

### 3. Access Slide Summaries

```python
# Get slide-by-slide summaries with auto-detected titles
content = get_ppt_content("company/code/file.pptx")

for slide in content['slides']:
    print(f"Slide {slide['slide_number']}: {slide['title']}")
    print(f"Content: {slide['text_content']}")
```

## API Reference

### Core Functions

#### `get_ppt_content(object_key: str) -> Dict[str, Any]`
Retrieve full PPT content from S3 by object key.

**Parameters:**
- `object_key` (str): S3 path to the PPT file (e.g., "company/1000/file.pptx")

**Returns:**
- `Dict` with keys:
  - `success` (bool): Whether extraction succeeded
  - `object_key` (str): The S3 object key
  - `file_name` (str): Extracted file name
  - `file_size` (int): File size in bytes
  - `slide_count` (int): Number of slides
  - `metadata` (Dict): Document metadata
  - `slides` (List[Dict]): Per-slide summaries
  - `full_text` (str): Complete text with semantic tags
  - `error` (Optional[str]): Error message if failed

**Raises:** `PPTContentExtractionError`, `KnowledgebaseDownloadError`

#### `extract_ppt_text(ppt_bytes: bytes) -> str`
Extract all text with semantic tags and coordinate ordering.

**Parameters:**
- `ppt_bytes` (bytes): Binary PPT file content

**Returns:**
- `str`: Text with semantic tags and slide markers
  - Format: `[CATEGORY]: text`
  - Includes `--- Slide N ---` markers for slide boundaries

**Raises:** `PPTContentExtractionError`

#### `get_ppt_metadata(ppt_bytes: bytes) -> Dict[str, Any]`
Extract metadata from PPT file.

**Parameters:**
- `ppt_bytes` (bytes): Binary PPT file content

**Returns:**
- `Dict` with keys:
  - `title` (str): Document title
  - `author` (str): Document author
  - `subject` (str): Document subject
  - `keywords` (str): Document keywords
  - `created` (str): ISO timestamp of creation
  - `modified` (str): ISO timestamp of last modification
  - `slide_count` (int): Total number of slides

**Raises:** `PPTContentExtractionError`

#### `get_ppt_slides_summary(ppt_bytes: bytes) -> List[Dict[str, Any]]`
Get slide-by-slide summary with semantic classification.

**Parameters:**
- `ppt_bytes` (bytes): Binary PPT file content

**Returns:**
- `List[Dict]` where each dict has:
  - `slide_number` (int): 1-indexed slide number
  - `title` (str): Auto-detected slide title
  - `text_content` (str): All text on the slide

**Raises:** `PPTContentExtractionError`

#### `get_ppt_contents_batch(object_keys: List[str]) -> List[Dict[str, Any]]`
Extract content from multiple PPT files in batch.

**Parameters:**
- `object_keys` (List[str]): List of S3 object keys

**Returns:**
- `List[Dict]`: Results for each file (success or error)

**Raises:** None (errors are included in results)

### LangGraph Integration

#### `create_ppt_content_node() -> Callable`
Factory function to create a LangGraph node for PPT extraction.

**Returns:** A node function that expects state with:
- `ppt_object_key` (str): S3 object key

And adds to state:
- `ppt_content` (Dict): Extraction result
- `ppt_extraction_error` (Optional[str]): Error if failed

**Example:**
```python
from langgraph.graph import StateGraph
from app.agents.skills.ppt_content_extractor import create_ppt_content_node

graph_builder = StateGraph(MyState)
graph_builder.add_node("extract_ppt", create_ppt_content_node())
```

#### `create_ppt_router_node() -> Callable`
Factory function to create a conditional router for PPT extraction.

**Returns:** A node that sets `has_ppt` in state based on presence of `ppt_object_key`

## Output Format Example

### extract_ppt_text() Output
```
--- Slide 1 ---
[TITLE]: TurboSAP Payroll System
[NARRATIVETEXT]: Introduction to the payroll system.
[NARRATIVETEXT]: Key features and benefits.
[LISTITEM]: Real-time processing
[LISTITEM]: Multi-currency support

--- Slide 2 ---
[TITLE]: Payment Methods
[LISTITEM]: Direct Deposit
[LISTITEM]: ACH Transfer
[LISTITEM]: Check Payment
[TABLE]: Method | Processing Time | Fee
```

### get_ppt_slides_summary() Output
```python
[
    {
        "slide_number": 1,
        "title": "TurboSAP Payroll System",
        "text_content": "Introduction to the payroll system.\nKey features and benefits.\nReal-time processing\nMulti-currency support"
    },
    {
        "slide_number": 2,
        "title": "Payment Methods",
        "text_content": "Direct Deposit\nACH Transfer\nCheck Payment\n..."
    }
]
```

## Error Handling

### Custom Exceptions

**PPTContentExtractionError**
- Raised when PPT parsing fails
- Includes detailed error message

**KnowledgebaseDownloadError**
- Raised when S3 download fails
- Includes S3-specific error details

### Error Handling Example

```python
from app.agents.skills.ppt_content_extractor import (
    get_ppt_content,
    PPTContentExtractionError,
)
from app.services.knowledgebase import KnowledgebaseDownloadError

try:
    content = get_ppt_content("company/1000/file.pptx")
except KnowledgebaseDownloadError as e:
    print(f"S3 Download Error: {e}")
except PPTContentExtractionError as e:
    print(f"Extraction Error: {e}")
```

## Configuration

### Unstructured.io Strategy Options

The `extract_ppt_text()` and `get_ppt_slides_summary()` functions use unstructured.io's `partition_pptx()` with a configurable strategy:

- **`"fast"`** (default): Quick processing, good for most use cases
- **`"hi_res"`**: Higher accuracy coordinate ordering, slower processing

To use `"hi_res"` strategy, modify the code in `get_ppt_content.py`:

```python
elements = partition_pptx(
    file=BytesIO(ppt_bytes),
    include_page_breaks=True,
    strategy="hi_res"  # Change from "fast" to "hi_res"
)
```

## Integration with TurboSAP

### In LangGraph Workflows

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional
from app.agents.skills.ppt_content_extractor import create_ppt_content_node

class PayrollState(TypedDict):
    ppt_object_key: str
    ppt_content: Optional[dict]
    ppt_extraction_error: Optional[str]

# Create graph
builder = StateGraph(PayrollState)
builder.add_node("extract_ppt", create_ppt_content_node())
builder.add_edge(START, "extract_ppt")
builder.add_edge("extract_ppt", END)

graph = builder.compile()

# Use in workflow
result = graph.invoke({
    "ppt_object_key": "acme_corp/1000/payroll_guide.pptx"
})
print(result["ppt_content"]["slides"])
```

### With Data Processing Pipelines

```python
from app.agents.skills.ppt_content_extractor import (
    get_ppt_contents_batch,
    extract_ppt_text,
)

# Process multiple training documents
files = [
    "company1/1000/training_part1.pptx",
    "company1/1000/training_part2.pptx",
    "company1/2000/advanced_topics.pptx",
]

results = get_ppt_contents_batch(files)

for result in results:
    if result['success']:
        # Process the semantically-classified text
        text = result['full_text']
        # Extract key concepts, create knowledge base, etc.
```

## Testing

Run the test suite:

```bash
cd backend
pytest app/agents/skills/ppt_content_extractor/test_skill.py -v
```

Test coverage includes:
- Semantic tag extraction
- Coordinate ordering logic
- Slide boundary detection
- Metadata extraction
- Batch processing
- Error handling

## Troubleshooting

### "unstructured module not found"
```bash
pip install unstructured>=0.10.0
```

### "python-pptx not installed"
```bash
pip install python-pptx>=0.6.21
```

### Coordinate ordering not working correctly
- Try changing strategy from `"fast"` to `"hi_res"` in the code
- Ensure unstructured.io version is >=0.10.0
- Check that PPT file is not corrupted

### Memory issues with large files
- Process files one-by-one instead of in batch
- Consider streaming/chunking large PPT files
- Monitor memory usage with large presentation files

## Performance Characteristics

- **Small PPT (< 5MB, < 50 slides)**: ~1-2 seconds
- **Medium PPT (5-20MB, 50-200 slides)**: ~2-5 seconds  
- **Large PPT (> 20MB, > 200 slides)**: ~5-10+ seconds

Times vary based on:
- Strategy used (fast vs. hi_res)
- Network latency to S3
- PPT file complexity
- System resources

## Version History

### v1.1.0 (Current) - January 24, 2026
- Enhanced with unstructured.io for coordinate-aware ordering
- Added automatic semantic classification (Title, NarrativeText, ListItem, Table, Footer)
- Improved slide boundary detection using PageBreak elements
- Updated documentation and examples
- Added comprehensive README

### v1.0.0 - Initial Release
- Basic PPT extraction from S3
- Metadata extraction
- LangGraph integration

## Contributing

When contributing enhancements:
1. Ensure tests pass: `pytest test_skill.py -v`
2. Update docstrings with new functionality
3. Add examples to QUICKSTART.md
4. Update this README with any new features
5. Maintain backward compatibility where possible

## License

Part of the TurboSAP Payroll System. See main repository LICENSE.

## Support

For issues or questions:
1. Check the [QUICKSTART.md](QUICKSTART.md) guide
2. Review [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for advanced usage
3. See [INSTRUCTIONS.md](INSTRUCTIONS.md) for detailed component information
4. Check test cases in [test_skill.py](test_skill.py) for usage examples
