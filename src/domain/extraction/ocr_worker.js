/**
 * @file domain/extraction/ocr_worker.js
 * @description Tesseract.js wrapper for handling scanned PDFs and images.
 * Provides a fallback mechanism when text layers are missing.
 * @version 1.0.0
 */

export const performOCR = async (file) => {
  try {
    // Dynamically import Tesseract.js to keep initial bundle small
    const Tesseract = await import('tesseract.js');
    
    console.log(`[OCR] Starting OCR process for ${file.name}...`);
    const { data: { text } } = await Tesseract.recognize(
      file,
      'eng',
      { 
        logger: m => console.log(`[OCR Progress] ${m.status}: ${Math.round(m.progress * 100)}%`),
        // Use a fast worker configuration for UX
      }
    );
    
    console.log(`[OCR] Successfully extracted text from image/scan.`);
    return text;
  } catch (error) {
    console.error(`[OCR Error] Failed to process ${file.name}:`, error);
    throw new Error(`OCR failed: ${error.message}`);
  }
};

/**
 * Checks if a PDF has a valid text layer.
 * @param {ArrayBuffer} buffer - The PDF file buffer
 * @returns {Promise<boolean>} True if text layer is present
 */
export const hasTextLayer = async (buffer) => {
  // Basic heuristic: check for the presence of common PDF text markers
  // A real implementation would use pdf.js to count text content
  const text = new TextDecoder().decode(buffer.slice(0, 10000));
  return text.includes('/Text') || text.includes('BT') || text.includes('ET');
};
