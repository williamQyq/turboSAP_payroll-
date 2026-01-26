"""
Unit tests for Enhanced PPT Content Extractor skill.
Validated for unstructured.io partitioning, coordinate ordering, and semantic tagging.
"""

try:
    from app.agents.skills.ppt_content_extractor.get_ppt_content import (
        get_ppt_content,
        extract_ppt_text,
        get_ppt_slides_summary,
        get_skill_info,
        PPTContentExtractionError,
        create_ppt_content_node
    )
    IMPORT_SUCCESS = True
except ImportError:
    IMPORT_SUCCESS = False


import pytest
from pathlib import Path
from io import BytesIO
from unittest.mock import Mock, patch, MagicMock


class MockUnstructuredElement:
    def __init__(self, text, category):
        self.text = text
        self.category = category

class MockPageBreak:
    pass


@pytest.mark.skipif(not IMPORT_SUCCESS, reason="Required modules not found")
class TestEnhancedPPTSkill:

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_extract_ppt_text_with_semantic_tags(self, mock_partition):

        mock_partition.return_value = [
            MockUnstructuredElement("TurboSAP Payroll Guide", "Title"),
            MockUnstructuredElement("This covers payment methods.", "NarrativeText")
        ]
        
        text = extract_ppt_text(b"fake_bytes")
        

        assert "[TITLE]: TurboSAP Payroll Guide" in text
        assert "[NARRATIVETEXT]: This covers payment methods." in text

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_coordinate_ordering_logic(self, mock_partition):

        elements = [
            MockUnstructuredElement("First Element", "Title"),
            MockUnstructuredElement("Second Element", "NarrativeText"),
            MockUnstructuredElement("Third Element", "ListItem")
        ]
        mock_partition.return_value = elements
        
        text = extract_ppt_text(b"fake_bytes")
        
        pos1 = text.find("First Element")
        pos2 = text.find("Second Element")
        pos3 = text.find("Third Element")
        assert pos1 < pos2 < pos3

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_slide_summary_with_page_breaks(self, mock_partition):

        elements = [
            MockUnstructuredElement("Slide 1 Title", "Title"),
            MockPageBreak(),
            MockUnstructuredElement("Slide 2 Title", "Title")
        ]
        mock_partition.return_value = elements
        
        summary = get_ppt_slides_summary(b"fake_bytes")
        
        assert len(summary) == 2
        assert summary[0]["slide_number"] == 1
        assert summary[0]["title"] == "Slide 1 Title"
        assert summary[1]["slide_number"] == 2
        assert summary[1]["title"] == "Slide 2 Title"

    def test_get_skill_info_version(self):

        info = get_skill_info()
        assert info["version"] == "1.1.0"
        assert "coordinate_aware_text_extraction" in info["capabilities"]

    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content._get_download_service')
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.get_ppt_content')
    def test_langgraph_node_execution(self, mock_get_content, mock_download):

        node = create_ppt_content_node()
        mock_get_content.return_value = {"success": True, "full_text": "Sample content"}
        
        initial_state = {"ppt_object_key": "company/code/test.pptx"}
        final_state = node(initial_state)
        
        assert "ppt_content" in final_state
        assert final_state["ppt_content"]["full_text"] == "Sample content"
        assert final_state["ppt_extraction_error"] is None

class TestErrorScenarios:
    
    @patch('app.agents.skills.ppt_content_extractor.get_ppt_content.partition_pptx')
    def test_invalid_file_error(self, mock_partition):

        mock_partition.side_effect = Exception("System Corrupted")
        
        with pytest.raises(PPTContentExtractionError) as excinfo:
            extract_ppt_text(b"broken_bytes")
        assert "Failed to extract text using unstructured" in str(excinfo.value)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])