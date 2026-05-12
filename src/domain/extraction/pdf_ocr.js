/**
 * @file domain/extraction/pdf_ocr.js
 * @description PDF and OCR text extraction services.
 * @version 1.0.0
 */

/**
 * Lazy-load PDF.js from CDN for in-browser PDF text extraction
 * @returns {Promise<Object>} pdfjsLib instance
 */
export const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error("PDF.js failed to load"));
    document.head.appendChild(s);
  });
};

/**
 * OCR fallback for scanned PDFs using Tesseract.js
 * @param {Object} pdf - pdfjsLib document instance
 * @param {number} maxPages - Number of pages to OCR
 * @returns {Promise<string>} Extracted OCR text
 */
export const tryOcrPages = async (pdf, maxPages) => {
  return new Promise(async (resolve) => {
    try {
      if (!window.Tesseract) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.3/tesseract.min.js";
          s.onload = res;
          s.onerror = () => rej(new Error("Tesseract.js failed to load"));
          document.head.appendChild(s);
        });
      }
      const worker = await Tesseract.createWorker("eng", 1, {
        logger: () => {}, /* suppress progress logs */
      });
      const ocrParts = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const { data: { text } } = await worker.recognize(canvas);
        ocrParts.push(text);
      }
      await worker.terminate();
      resolve(ocrParts.join("\n"));
    } catch (e) {
      console.warn("[OCR] Tesseract failed:", e.message);
      resolve("");
    }
  });
};

/**
 * Extract text from PDF files, with automatic OCR fallback for scanned docs
 * @param {File} file - The PDF file object
 * @returns {Promise<string>} Extracted text
 */
export const extractPdfText = async (file) => {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const texts = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    texts.push(tc.items.map(it => it.str).join(" "));
  }
  const allText = texts.join("\n");

  /* Scanned-PDF detection: avg chars per page very low = likely image scan */
  const avgChars = allText.replace(/\s+/g, "").length / Math.max(1, pdf.numPages);
  if (avgChars < 60) {
    /* Attempt OCR on first 10 pages */
    const ocrText = await tryOcrPages(pdf, Math.min(pdf.numPages, 10));
    if (ocrText.trim().length > allText.trim().length + 200) {
      console.info(`[OCR] Extracted ${ocrText.length} chars vs ${allText.length} native using OCR output`);
      return ocrText;
    }
  }
  return allText;
};

/**
 * Unified file text extraction entry point
 * @param {File} file - The file object to extract text from
 * @returns {Promise<string>} Extracted text
 */
export const extractFileText = async (file) => {
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    return extractPdfText(file);
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = (e) => resolve(e.target.result || "");
    fr.onerror = reject;
    fr.readAsText(file);
  });
};
