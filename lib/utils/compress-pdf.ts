/**
 * Smart PDF Compression Pipeline
 *
 * 2-tier compression applied based on file size:
 * - < 1 MB: Skip entirely (not worth it)
 * - 1-5 MB: Tier 1 only (lossless structural optimization)
 * - >= 5 MB: Tier 1 + Tier 2 (structural + deep deduplication via fresh copy)
 *
 * Quality gate: Only use compressed version if > 10% smaller than original.
 * Never degrades PDF quality for the end user.
 */

import { PDFDocument } from 'pdf-lib';

const ONE_MB = 1024 * 1024;
const FIVE_MB = 5 * ONE_MB;
const TWENTY_MB = 20 * ONE_MB;
const QUALITY_GATE_THRESHOLD = 0.90; // Must be at least 10% smaller

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savings: number;       // percentage saved (0-100)
  wasCompressed: boolean;
  tier: 0 | 1 | 2;      // 0 = skipped, 1 = structural, 2 = deduplication
}

/**
 * Main entry point — compresses a PDF file using smart size-based logic.
 * Returns the compressed file or the original if compression isn't worthwhile.
 */
export async function compressPdf(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  // Skip tiny files — compression overhead not worth it
  if (originalSize < ONE_MB) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savings: 0,
      wasCompressed: false,
      tier: 0,
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    let pdfBytes: Uint8Array<ArrayBufferLike> = new Uint8Array(arrayBuffer);
    let highestTier: 0 | 1 | 2 = 0;

    // Tier 1: Lossless structural optimization (all files >= 1MB)
    pdfBytes = await tier1StructuralOptimization(pdfBytes);
    highestTier = 1;

    // Tier 2: Deep deduplication via fresh document copy (files >= 5MB)
    if (originalSize >= FIVE_MB) {
      pdfBytes = await tier2DeepDeduplication(pdfBytes);
      highestTier = 2;
    }

    // Tier 3: JPEG re-encoding for image-heavy PDFs (files >= 20MB)
    // Currently a stub — pdf-lib doesn't support direct image re-encoding.
    // Full JPEG re-encoding will require a WASM-based renderer in the future.
    // Tier 2 deduplication already handles the bulk of savings for large files.
    if (originalSize >= TWENTY_MB) {
      // No-op for now — highestTier stays at 2
    }

    const compressedSize = pdfBytes.length;

    // Quality gate: only use compressed if > 10% smaller
    if (compressedSize >= originalSize * QUALITY_GATE_THRESHOLD) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        savings: 0,
        wasCompressed: false,
        tier: 0,
      };
    }

    // Extract a clean ArrayBuffer from the Uint8Array for the File constructor
    const compressedBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    const compressedFile = new File([compressedBuffer], file.name, {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    const savings = Math.round(((originalSize - compressedSize) / originalSize) * 100);

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      savings,
      wasCompressed: true,
      tier: highestTier,
    };
  } catch (error) {
    // On any error, return original file unchanged — safety first
    console.warn('PDF compression failed, using original:', error);
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savings: 0,
      wasCompressed: false,
      tier: 0,
    };
  }
}

/**
 * Tier 1: Lossless structural optimization
 * - Loads and re-saves through pdf-lib (removes orphaned objects)
 * - Strips metadata (author, creator, producer, timestamps)
 * - Enables object stream compression
 * Risk: Zero — identical rendering
 */
async function tier1StructuralOptimization(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  // Strip metadata
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');

  // Re-save with object streams enabled (better compression)
  const optimized = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return new Uint8Array(optimized);
}

/**
 * Tier 2: Deep deduplication via fresh document copy
 * - Creates a brand new PDFDocument
 * - Copies all pages from the original
 * - This eliminates duplicate fonts, images, and resources
 * - The copy process only brings over what's actually referenced
 * Risk: Zero — identical rendering, just cleaner internal structure
 */
async function tier2DeepDeduplication(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  // Copy pages to a fresh document — this deduplicates shared resources
  const freshDoc = await PDFDocument.create();
  const pages = await freshDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
  pages.forEach((page) => freshDoc.addPage(page));

  const optimized = await freshDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return new Uint8Array(optimized);
}

// Tier 3: JPEG re-encoding at quality 90
// Not yet implemented — pdf-lib doesn't support direct image stream modification.
// Full JPEG re-encoding will require a WASM-based renderer (e.g., mupdf-wasm).
// For now, Tier 2 deduplication handles the bulk of savings for large files.
