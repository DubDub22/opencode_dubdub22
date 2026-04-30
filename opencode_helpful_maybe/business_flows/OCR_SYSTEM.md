# OCR System Documentation

## Overview

The OCR system uses **Tesseract OCR** (traditional OCR, not AI-based) to extract text from FFL documents. No AI services or APIs are required - everything runs locally and offline.

## Supported File Types

### ✅ Fully Supported
- **PNG, JPG, JPEG, GIF** - Direct OCR on images
- **PDF** - Converts pages to images, then OCR
- **DOCX** - Extracts text directly (no OCR needed, more accurate)

### ⚠️ Limited Support
- **DOC** - Legacy Word format. Not fully supported. Users should convert to DOCX, PDF, or image format.

## How It Works

### Images (PNG, JPG, etc.)
1. Image is opened with PIL/Pillow
2. Tesseract OCR extracts text
3. Text is parsed for FFL data

### PDF Files
1. PDF pages are converted to images using `pdf2image` (requires `poppler-utils`)
2. Each page image is processed with Tesseract OCR
3. All page text is combined
4. Text is parsed for FFL data

### DOCX Files
1. Text is extracted directly from the Word document using `python-docx`
2. No OCR needed - more accurate and faster
3. Text is parsed for FFL data

## System Dependencies

### Required System Packages (Ubuntu/Debian)
```bash
sudo apt-get install tesseract-ocr poppler-utils
```

### Python Packages (in requirements.txt)
- `pytesseract==0.3.10` - Python wrapper for Tesseract
- `pdf2image==1.16.3` - PDF to image conversion
- `python-docx==1.1.0` - DOCX text extraction
- `Pillow==10.1.0` - Image processing

## Extracted Data

The OCR system extracts:
- FFL Number
- FFL Type (01, 07, etc.)
- Business Name
- Contact Name
- Address
- City, State, ZIP
- Phone Number
- Email Address
- Expiration Date

## Advantages of Non-AI OCR

✅ **No API costs** - Runs completely offline  
✅ **No rate limits** - Process as many documents as needed  
✅ **Privacy** - Documents never leave your server  
✅ **Fast** - No network latency  
✅ **Reliable** - No dependency on external services  
✅ **Free** - Open source software  

## Accuracy

- **DOCX files**: Very high accuracy (direct text extraction)
- **PDF files**: High accuracy (300 DPI conversion)
- **Image files**: Good accuracy (depends on image quality)

## Error Handling

The system gracefully handles:
- Missing dependencies (warns but continues)
- Unsupported file types (clear error messages)
- OCR failures (logs error and raises exception)
- Corrupted files (handled by underlying libraries)

## Future Enhancements

- Image preprocessing (deskewing, contrast adjustment)
- Multi-language support (if needed)
- Confidence scoring for extracted data
- Manual review workflow for low-confidence extractions



