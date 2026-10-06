"""Master compiler to generate PROJECT-BACKEND-DATABASE-GUIDE.docx."""
import os
import sys
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor

# Add project root to sys.path
root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir))

from scripts.doc_content_p1 import build_section_1_to_5
from scripts.doc_content_p2 import build_section_6_to_10
from scripts.doc_content_p3 import build_section_11_to_15
from scripts.doc_content_p4 import build_section_16_to_20

def generate_full_document(output_path: str):
    print(f"Creating Document: {output_path}...")
    doc = Document()
    
    # Configure Page Margins (1 inch all sides)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)

    # Base style settings
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)

    print("Building Sections 1 to 5...")
    build_section_1_to_5(doc)
    doc.add_page_break()

    print("Building Sections 6 to 10...")
    build_section_6_to_10(doc)
    doc.add_page_break()

    print("Building Sections 11 to 15...")
    build_section_11_to_15(doc)
    doc.add_page_break()

    print("Building Sections 16 to 20...")
    build_section_16_to_20(doc)

    print(f"Saving to {output_path}...")
    doc.save(output_path)
    file_size_kb = os.path.getsize(output_path) / 1024
    print(f"SUCCESS: Document created successfully ({file_size_kb:.2f} KB) at {output_path}")

if __name__ == "__main__":
    target_file = str(root_dir / "PROJECT-BACKEND-DATABASE-GUIDE.docx")
    generate_full_document(target_file)
