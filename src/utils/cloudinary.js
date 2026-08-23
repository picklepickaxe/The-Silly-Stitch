const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads a single image file to Cloudinary (unsigned upload).
 * Returns the RAW secure_url — no transformation baked in.
 *
 * Why raw? Baking a fixed size (e.g. w_1000) into the stored URL means
 * every place that uses it — a tiny grid thumbnail, a big overlay image —
 * downloads the SAME file size. Instead we store the raw URL and apply
 * the right transformation per context at render time (see getThumbnailUrl
 * / getDetailUrl below). This is also why we don't pass an `eager` param
 * here — eager transformations are generated (and billed) immediately on
 * upload whether or not anyone ever views that size. Generating sizes on
 * first request instead means you only ever pay for sizes actually used,
 * and Cloudinary's CDN caches each derived size after that.
 */
export async function uploadImageToCloudinary(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary env vars are missing. Check your .env file.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "crochet-products");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || "Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}

/**
 * Uploads multiple files in parallel, returns their raw URLs.
 * onEachDone is called after each individual upload finishes (for a progress counter).
 */
export async function uploadImagesToCloudinary(files, onEachDone) {
  const uploads = Array.from(files).map(async (file) => {
    const url = await uploadImageToCloudinary(file);
    onEachDone?.();
    return url;
  });
  return Promise.all(uploads);
}

// ─── Delivery-time transformations ─────────────────────────────────────────

// Matches a transformation segment already baked into a Cloudinary URL, e.g.
// ".../upload/f_auto,q_auto,c_limit,w_1000/v123/..." — the part right after
// /upload/ made of comma-separated key_value tokens (f_auto, w_1000, etc).
// This lets old URLs (uploaded before this change) get re-optimized safely
// instead of stacking a second transformation on top of the old one.
const TRANSFORM_SEGMENT = /\/upload\/(?:[a-z]+_[^/,]+,)*[a-z]+_[^/,]+\//i;

/**
 * Returns a Cloudinary delivery URL with a given transformation applied.
 * Always includes f_auto (best format: WebP/AVIF where supported) and
 * q_auto (best quality/size tradeoff) — these two alone typically cut
 * file size 50-80% with no visible quality loss.
 */
export function getCloudinaryUrl(url, { width, height, crop = "fill" } = {}) {
  if (!url || !url.includes("/upload/")) return url; // not a Cloudinary URL (e.g. /placeholder.webp)

  const sizePart = width
    ? `,w_${width}${height ? `,h_${height}` : ""},c_${crop}`
    : "";
  const transform = `f_auto,q_auto${sizePart}`;

  const stripped = url.replace(TRANSFORM_SEGMENT, "/upload/");
  return stripped.replace("/upload/", `/upload/${transform}/`);
}

// Fixed, reused presets — keep these constant across the whole app rather
// than computing widths dynamically per component. Cloudinary caches each
// distinct transformation string as its own derived asset; reusing the same
// string everywhere means later requests hit the CDN cache (free) instead
// of generating a new derived asset (billed) each time.
export const THUMB_TRANSFORM = { width: 400, height: 400, crop: "fill" }; // grid tiles + overlay strip
export const DETAIL_TRANSFORM = { width: 1000, crop: "limit"};                          // used only for the lightbox now

export function getThumbnailUrl(url) {
  return getCloudinaryUrl(url, THUMB_TRANSFORM);
}

export function getDetailUrl(url) {
  return getCloudinaryUrl(url, DETAIL_TRANSFORM);
}