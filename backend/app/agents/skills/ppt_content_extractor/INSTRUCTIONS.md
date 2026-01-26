# PPT Content Extractor - Implementation Guide

**For**: Developers maintaining or extending this skill  
**See also**: [SKILL.md](SKILL.md) for agent usage, [README.md](README.md) for reference

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent/External Code                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
        ┌────────────────────────────────────┐
        │    get_ppt_content() (Main Entry)  │
        └─────────────┬──────────────────────┘
                      │
        ┌─────────────┴──────────────────────┐
        │                                    │
        ↓                                    ↓
   ┌──────────────────┐        ┌──────────────────────┐
   │  S3 Download     │        │  PPT Processing      │
   │  (KB Service)    │        │  (unstructured.io)   │
   └──────────────────┘        └──────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ↓                 ↓                 ↓
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │Extract Text  │  │Get Metadata  │  │Slide Summary │
            │(Semantic)    │  │(python-pptx) │  │(Semantic)    │
            └──────────────┘  └──────────────┘  └──────────────┘
                    │                 │                 │
                    └─────────────────┴─────────────────┘
                                      │
                                      ↓
                            ┌──────────────────┐
                            │  Return Result   │
                            │  Dict with all   │
                            │  content/metadata│
                            └──────────────────┘
```

---

## Key Components

### 1. **get_ppt_content()** - Main Entry Point
```python
def get_ppt_content(object_key: str) -> Dict[str, Any]
```

**Flow**:
1. Download PPT bytes from S3 via `KnowledgebaseDownloadService`
2. Call `extract_ppt_text()` for semantic text
3. Call `get_ppt_metadata()` for document metadata
4. Call `get_ppt_slides_summary()` for slide-by-slide analysis
5. Combine results into single response dict

**Error Handling**:
- `KnowledgebaseDownloadError` → Download failed
- `PPTContentExtractionError` → Processing failed

### 2. **extract_ppt_text()** - Coordinate-Aware Text Extraction
```python
def extract_ppt_text(ppt_bytes: bytes) -> str
```

**Algorithm**:
1. Use `unstructured.partition_pptx()` with `include_page_breaks=True`
2. Iterate through elements returned by unstructured
3. Detect PageBreak elements (slide boundaries)
4. Extract text and semantic category from each element
5. Format as `[CATEGORY]: text` with slide markers

**Semantic Categories** (from unstructured.io):
- `Title` - Slide titles and headings
- `NarrativeText` - Body paragraphs
- `ListItem` - Bulleted/numbered items
- `Table` - Table content
- `Footer` - Footer text

**Configuration**:
- `strategy="fast"` (default) - Speed vs. accuracy tradeoff
- `strategy="hi_res"` (optional) - Higher accuracy, slower

### 3. **get_ppt_metadata()** - Document Metadata
```python
def get_ppt_metadata(ppt_bytes: bytes) -> Dict[str, Any]
```

**Data Extracted**:
- `title` - Document title (from core properties)
- `author` - Document author
- `subject` - Document subject
- `keywords` - Document keywords
- `created` - Creation timestamp (ISO format)
- `modified` - Modification timestamp (ISO format)
- `slide_count` - Total number of slides

**Technology**: Uses `python-pptx` Presentation API

### 4. **get_ppt_slides_summary()** - Slide Analysis
```python
def get_ppt_slides_summary(ppt_bytes: bytes) -> List[Dict[str, Any]]
```

**Algorithm**:
1. Partition PPT using `unstructured.partition_pptx()`
2. Group elements by slide (using PageBreak detection)
3. Auto-detect slide title (first element with category="Title")
4. Collect remaining text as slide content
5. Return list of slide summaries

**Output Format**:
```python
[
    {
        "slide_number": 1,
        "title": "Auto-detected title",
        "text_content": "All text from slide..."
    },
    ...
]
```

---

## Dependencies & Integration

### External Services

**KnowledgebaseDownloadService**
- Purpose: Download files from S3
- Location: `app.services.knowledgebase`
- Usage: `_get_download_service()._download_bytes(object_key)`

**ReachNettDataManager**
- Purpose: Manage data across the application
- Location: `app.data`
- Status: Imported but not actively used (can be extended)

### Python Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `python-pptx` | >=0.6.21 | PPT structure & metadata |
| `unstructured` | >=0.10.0 | Coordinate-aware partitioning |

---

## Data Flow Examples

### Example 1: Simple Text Extraction

**Input**: S3 path to PPT file  
**Output**: Semantically-tagged text

```
get_ppt_content("company/1000/guide.pptx")
    ↓
Download bytes from S3
    ↓
partition_pptx(bytes)  [unstructured.io]
    ↓
Detect PageBreaks (slides)
    ↓
Format: [TITLE]: ..., [NARRATIVETEXT]: ...
    ↓
Return full_text field
```

### Example 2: Batch Processing

**Input**: Multiple S3 paths  
**Output**: Results array with successes/errors

```
get_ppt_contents_batch([file1, file2, file3])
    ↓
For each file:
    ├─ Try get_ppt_content()
    ├─ On success: Add result to list
    └─ On error: Add error object to list
    ↓
Return combined results list
```

### Example 3: LangGraph Integration

**Input**: State dict with ppt_object_key  
**Output**: Updated state with ppt_content

```
create_ppt_content_node()
    ↓
Returns node function that:
    ├─ Reads ppt_object_key from state
    ├─ Calls get_ppt_content()
    ├─ Updates state["ppt_content"]
    └─ Sets state["ppt_extraction_error"] if failed
    ↓
Graph can route based on success/failure
```

---

## Error Handling

### Exception Hierarchy

```
Exception
├── PPTContentExtractionError
│   ├── Text extraction failed
│   ├── Metadata extraction failed
│   ├── Slide summary generation failed
│   └── unstructured.io parsing failed
│
└── KnowledgebaseDownloadError
    ├── S3 file not found
    ├── S3 access denied
    └── Download timeout/network error
```

### Error Recovery Strategies

**Strategy 1: Retry with different settings**
```python
try:
    content = get_ppt_content("file.pptx")
except PPTContentExtractionError:
    # Retry with hi_res strategy
    # (Modify code to use hi_res, retry)
```

**Strategy 2: Partial recovery**
```python
try:
    # Try full extraction
    content = get_ppt_content("file.pptx")
except PPTContentExtractionError:
    # Fall back to basic extraction
    metadata = get_ppt_metadata(bytes)
    # Return partial result
```

**Strategy 3: Log and skip**
```python
results = get_ppt_contents_batch(files)
for result in results:
    if result.get("error"):
        logger.error(f"Failed: {result['object_key']}")
        # Continue with next file
```

---

## Testing

### Test Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| Semantic tags | 1 test | `extract_ppt_text()` |
| Coordinate ordering | 1 test | Element ordering |
| Slide detection | 1 test | PageBreak handling |
| Metadata | 1 test | Metadata extraction |
| LangGraph node | 1 test | Node execution |
| Error handling | 2+ tests | Exception cases |

### Running Tests

```bash
cd backend
pytest app/agents/skills/ppt_content_extractor/test_skill.py -v
```

### Test Pattern

```python
@patch('get_ppt_content.partition_pptx')
def test_semantic_tags(mock_partition):
    # Setup mock data
    mock_partition.return_value = [
        MockElement("Title", "Title"),
        MockElement("Body text", "NarrativeText"),
    ]
    
    # Call function
    text = extract_ppt_text(b"fake_bytes")
    
    # Assert
    assert "[TITLE]: Title" in text
    assert "[NARRATIVETEXT]: Body text" in text
```

---

## Configuration

### Strategy Options

The `extract_ppt_text()` and `get_ppt_slides_summary()` functions use configurable strategies:

**Fast Strategy** (default)
- Speed: 1-2 seconds per file
- Accuracy: Good for most documents
- Use case: Production, batch processing

**Hi-Res Strategy**
- Speed: 5-10 seconds per file
- Accuracy: Better coordinate ordering
- Use case: Complex layouts, critical accuracy needed

**To change strategy**, modify in `get_ppt_content.py`:

```python
# Find these lines and change "fast" to "hi_res"
elements = partition_pptx(
    file=BytesIO(ppt_bytes),
    include_page_breaks=True,
    strategy="hi_res"  # Change here
)
```

---

## Extension Points

### Adding New Metadata Fields

In `get_ppt_metadata()`:
```python
# Add custom fields
metadata["custom_field"] = props.custom_property
metadata["computed_field"] = compute_something(props)
```

### Supporting Additional File Formats

Currently: `.pptx` only (Office Open XML)

To add `.ppt` (legacy PowerPoint):
1. Handle different import path
2. Adjust parsing logic for older format
3. Update metadata extraction (different API)
4. Add format detection in `get_ppt_content()`

### Custom Semantic Categories

To add custom semantic classification:
1. Post-process `el.category` in `extract_ppt_text()`
2. Map unstructured.io categories to custom ones
3. Update output format in documentation

---

## Performance Characteristics

### Typical Timings

| File Size | Slides | Strategy | Time |
|-----------|--------|----------|------|
| < 5 MB | < 50 | fast | 1-2s |
| 5-20 MB | 50-200 | fast | 2-5s |
| > 20 MB | > 200 | fast | 5-10s |
| < 5 MB | < 50 | hi_res | 2-3s |
| 5-20 MB | 50-200 | hi_res | 5-10s |

### Optimization Tips

1. **Batch processing**: Process multiple files in parallel
2. **Strategy selection**: Use "fast" by default, "hi_res" only when needed
3. **Caching**: Cache results for frequently accessed files
4. **Streaming**: For very large files, consider streaming/chunking

---

## Future Enhancements

### Planned Features
- [ ] Image extraction and description
- [ ] Speaker notes extraction (current: not implemented)
- [ ] Custom element mapping
- [ ] OCR for image-based text
- [ ] Language detection and translation

### Known Limitations
- Only `.pptx` format supported (not legacy `.ppt`)
- Charts/graphs not extracted as separate elements
- Speaker notes not currently extracted
- No embedded media extraction

---

## Support & Debugging

### Common Issues

**Issue**: "unstructured module not found"
```bash
pip install unstructured>=0.10.0
```

**Issue**: Text ordering seems wrong
- Check if using "fast" strategy
- Try switching to "hi_res" for better accuracy
- Verify PPT file isn't corrupted

**Issue**: Metadata fields missing
- Check PPT file's core properties are set
- Some fields may be empty in source document

### Debug Logging

To add debug output:

```python
import logging
logger = logging.getLogger(__name__)

# In extract_ppt_text():
logger.debug(f"Found {len(elements)} elements")
logger.debug(f"Slide {current_slide_num}: {el.category} - {el.text}")
```

---

## Maintenance Notes

### When to Update Dependencies

- **unstructured**: Update quarterly for bug fixes, biennially for major versions
- **python-pptx**: Update annually or when bugs reported

### Code Review Checklist

- [ ] All docstrings updated
- [ ] Error handling covers new cases
- [ ] Tests added for new functionality
- [ ] Performance not degraded
- [ ] Backward compatibility maintained

---

*Last Updated: January 25, 2026*  
*Version: 1.1.0*
