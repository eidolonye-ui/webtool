/**
 * @file domain/extraction/pdf_ocr.js
 * @description PDF and OCR text extraction services.
 * @version 2.0.0 - Hybrid per-page OCR: scanned pages detected individually,
 *                  OCR cap raised 10→50 pages, native cap raised 30→80 pages.
 *
 * Previous bugs fixed:
 *   (1) OCR page cap was 10 — S32 covenant sections start at page 10–25 typically.
 *   (2) Scanned detection used document-average chars ÷ total pages, not pages processed:
 *       a hybrid PDF (5 text pages + 25 image pages) could average >60 chars/page and
 *       skip OCR entirely even though all content pages were scanned images.
 *   (3) OCR output was discarded unless it was 200+ chars longer than native garbage —
 *       clean OCR text often "lost" to shorter-but-accurate output vs longer binary junk.
 *   (4) Monolithic OCR (all-or-nothing) replaced the full native text even for pages
 *       that already had good native text (cover, index, table of contents).
 *
 * New strategy — Hybrid per-page extraction:
 *   1. Extract native text for ALL pages (up to MAX_NATIVE_PAGES).
 *   2. Identify "sparse" pages: non-whitespace char count < SPARSE_THRESHOLD.
 *   3. If ≥ MIN_SPARSE_PAGES sparse pages exist, OCR them individually (up to MAX_OCR_PAGES).
 *   4. Build hybrid output: replace sparse pages with their OCR text, keep native elsewhere.
 */

const MAX_NATIVE_PAGES = 80;   // how many pages to attempt native PDF.js extraction
const MAX_OCR_PAGES    = 50;   // max pages to send through Tesseract (performance guard)
const SPARSE_THRESHOLD = 30;   // non-ws chars below this = likely scanned image page
const MIN_SPARSE_PAGES = 2;    // require at least this many sparse pages before OCR kicks in

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
 * Load Tesseract.js from CDN (once) and return the global Tesseract object.
 * @returns {Promise<Object>}
 */
const loadTesseract = () => {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) { resolve(window.Tesseract); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.3/tesseract.min.js";
    s.onload  = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error("Tesseract.js failed to load"));
    document.head.appendChild(s);
  });
};

/**
 * OCR a specific set of page numbers from a PDF document.
 * Returns a map of { pageNum: ocrText }.
 *
 * @param {Object}   pdf       - pdfjsLib document instance
 * @param {number[]} pageNums  - 1-based page numbers to OCR
 * @returns {Promise<Object>}  { [pageNum]: string }
 */
export const tryOcrSpecificPages = async (pdf, pageNums) => {
  const result = {};
  if (!pageNums.length) return result;
  try {
    const Tesseract = await loadTesseract();
    const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
    for (const pageNum of pageNums) {
      try {
        const page     = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas   = document.createElement("canvas");
        canvas.width   = viewport.width;
        canvas.height  = viewport.height;
        const ctx      = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        const { data: { text } } = await worker.recognize(canvas);
        result[pageNum] = text;
      } catch (pageErr) {
        console.warn(`[OCR] Page ${pageNum} failed:`, pageErr.message);
        result[pageNum] = '';
      }
    }
    await worker.terminate();
  } catch (e) {
    console.warn("[OCR] Tesseract worker failed:", e.message);
  }
  return result;
};

/**
 * Legacy: OCR first N pages sequentially. Kept for external callers.
 */
export const tryOcrPages = async (pdf, maxPages) => {
  const nums = Array.from({ length: Math.min(maxPages, pdf.numPages) }, (_, i) => i + 1);
  const map  = await tryOcrSpecificPages(pdf, nums);
  return nums.map(n => map[n] || '').join('\n');
};

/**
 * Extract text from a PDF using a hybrid per-page strategy.
 */
export const extractPdfText = async (file) => {
  const pdfjs = await loadPdfJs();
  const buf   = await file.arrayBuffer();
  const pdf   = await pdfjs.getDocument({ data: buf }).promise;

  // Step 1: Native text extraction (all pages up to cap)
  const pageData = [];
  const processPages = Math.min(pdf.numPages, MAX_NATIVE_PAGES);

  for (let i = 1; i <= processPages; i++) {
    const page  = await pdf.getPage(i);
    const tc    = await page.getTextContent();
    const text  = tc.items.map(it => it.str).join(" ");
    pageData.push({ pageNum: i, text, nonWsChars: text.replace(/\s+/g, '').length });
  }

  // Step 2: Identify sparse (likely scanned) pages
  const sparsePages = pageData
    .filter(p => p.nonWsChars < SPARSE_THRESHOLD)
    .map(p => p.pageNum);

  console.info(`[PDF] ${file.name}: ${processPages} pages, ${sparsePages.length} sparse`);

  // Step 3: OCR sparse pages if there are enough of them
  if (sparsePages.length >= MIN_SPARSE_PAGES) {
    const pagesToOcr = sparsePages.slice(0, MAX_OCR_PAGES);
    console.info(`[OCR] Running OCR on ${pagesToOcr.length} sparse pages`);

    const ocrMap = await tryOcrSpecificPages(pdf, pagesToOcr);

    // Step 4: Hybrid merge - replace sparse page slots with OCR text
    const hybridParts = pageData.map(p => {
      if (ocrMap[p.pageNum] !== undefined && ocrMap[p.pageNum].trim().length > p.nonWsChars) {
        return ocrMap[p.pageNum];
      }
      return p.text;
    });

    const hybridText = hybridParts.join('\n');
    console.info(`[OCR] Hybrid text non-ws chars: ${hybridText.replace(/\s+/g,'').length}`);
    return hybridText;
  }

  // No OCR needed: return native text
  return pageData.map(p => p.text).join('\n');
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
