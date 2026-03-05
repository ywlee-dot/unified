"""File parser for various document formats."""

import logging
import io
from pathlib import Path
import pypdf

logger = logging.getLogger(__name__)


class FileParser:
    """Parse various file formats to extract text content."""

    SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.xlsx', '.xls', '.hwp', '.hwpx', '.docx'}

    @staticmethod
    def parse_file(file_path: str, file_content: bytes, filename: str) -> str:
        file_ext = Path(filename).suffix.lower()

        if file_ext not in FileParser.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"지원하지 않는 파일 형식: {file_ext}. "
                f"지원 형식: {', '.join(FileParser.SUPPORTED_EXTENSIONS)}"
            )

        try:
            if file_ext == '.pdf':
                return FileParser._parse_pdf(file_content)
            elif file_ext == '.txt':
                return FileParser._parse_txt(file_content)
            elif file_ext in {'.xlsx', '.xls'}:
                return FileParser._parse_excel(file_content)
            elif file_ext == '.hwp':
                return FileParser._parse_hwp(file_content)
            elif file_ext == '.hwpx':
                return FileParser._parse_hwpx(file_content)
            elif file_ext == '.docx':
                return FileParser._parse_docx(file_content)
            else:
                raise ValueError(f"Parser not implemented for {file_ext}")
        except Exception as e:
            logger.error(f"Error parsing file {filename}: {e}")
            raise

    @staticmethod
    def _parse_pdf(content: bytes) -> str:
        pdf_file = io.BytesIO(content)
        pdf_reader = pypdf.PdfReader(pdf_file)
        text_parts = []
        for page_num, page in enumerate(pdf_reader.pages, 1):
            text = page.extract_text()
            if text.strip():
                text_parts.append(f"[페이지 {page_num}]\n{text}")
        return "\n\n".join(text_parts)

    @staticmethod
    def _parse_txt(content: bytes) -> str:
        encodings = ['utf-8', 'cp949', 'euc-kr', 'latin-1']
        for encoding in encodings:
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                continue
        return content.decode('utf-8', errors='ignore')

    @staticmethod
    def _parse_excel(content: bytes) -> str:
        try:
            import openpyxl
            import pandas as pd
        except ImportError:
            raise ImportError("openpyxl and pandas are required for Excel parsing.")

        excel_file = io.BytesIO(content)
        try:
            df_dict = pd.read_excel(excel_file, sheet_name=None, engine='openpyxl')
            text_parts = []
            for sheet_name, df in df_dict.items():
                text_parts.append(f"[시트: {sheet_name}]")
                text_parts.append(df.to_string(index=False))
                text_parts.append("")
            return "\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file: {e}")

    @staticmethod
    def _parse_hwp(content: bytes) -> str:
        try:
            import olefile
            import zlib
        except ImportError:
            raise ImportError("olefile is required for HWP parsing.")

        try:
            hwp_file = io.BytesIO(content)
            ole = olefile.OleFileIO(hwp_file)
            text_parts = []
            section_count = 0

            for entry in ole.listdir():
                entry_name = '/'.join(entry)
                if 'BodyText/Section' in entry_name:
                    try:
                        section_count += 1
                        stream = ole.openstream(entry)
                        data = stream.read()
                        try:
                            if len(data) > 4:
                                decompressed = zlib.decompress(data, -15)
                                data = decompressed
                        except Exception:
                            pass

                        text = ""
                        try:
                            text = data.decode('utf-16le', errors='ignore')
                        except Exception:
                            try:
                                text = data.decode('utf-8', errors='ignore')
                            except Exception:
                                try:
                                    text = data.decode('cp949', errors='ignore')
                                except Exception:
                                    pass

                        text = text.replace('\x00', '').replace('\x01', '').replace('\x02', '')
                        text = ''.join(char for char in text if char.isprintable() or char.isspace())

                        if text.strip() and len(text.strip()) > 10:
                            text_parts.append(f"[섹션 {section_count}]\n{text.strip()}")
                    except Exception as e:
                        logger.warning(f"Failed to parse section {entry_name}: {e}")
                        continue

            ole.close()

            if text_parts:
                return "\n\n".join(text_parts)
            else:
                raise ValueError("HWP 파일에서 텍스트를 추출할 수 없습니다.")
        except Exception as e:
            logger.error(f"Error parsing HWP file: {e}")
            raise ValueError(f"HWP 파일 파싱 실패: {str(e)}")

    @staticmethod
    def _parse_hwpx(content: bytes) -> str:
        import zipfile
        import xml.etree.ElementTree as ET

        try:
            hwpx_file = io.BytesIO(content)
            text_parts = []

            with zipfile.ZipFile(hwpx_file, 'r') as zip_ref:
                file_list = zip_ref.namelist()
                section_files = [f for f in file_list if f.startswith('Contents/section') and f.endswith('.xml')]
                section_files.sort()

                for section_file in section_files:
                    try:
                        xml_content = zip_ref.read(section_file)
                        root = ET.fromstring(xml_content)
                        text_elements = []
                        for elem in root.iter():
                            if elem.text and elem.text.strip():
                                text_elements.append(elem.text.strip())
                            if elem.tail and elem.tail.strip():
                                text_elements.append(elem.tail.strip())
                        if text_elements:
                            section_text = '\n'.join(text_elements)
                            if len(section_text.strip()) > 10:
                                text_parts.append(section_text)
                    except Exception as e:
                        logger.warning(f"Failed to parse section {section_file}: {e}")
                        continue

            if text_parts:
                return "\n\n".join(text_parts)
            else:
                raise ValueError("HWPX 파일에서 텍스트를 추출할 수 없습니다.")
        except zipfile.BadZipFile:
            raise ValueError("HWPX 파일이 올바른 ZIP 형식이 아닙니다.")
        except Exception as e:
            logger.error(f"Error parsing HWPX file: {e}")
            raise ValueError(f"HWPX 파일 파싱 실패: {str(e)}")

    @staticmethod
    def _parse_docx(content: bytes) -> str:
        try:
            from docx import Document
        except ImportError:
            raise ImportError("python-docx is required for DOCX parsing.")

        docx_file = io.BytesIO(content)
        doc = Document(docx_file)
        text_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
        return "\n\n".join(text_parts)
