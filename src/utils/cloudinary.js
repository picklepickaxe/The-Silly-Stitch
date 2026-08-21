const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Uploads a single image file to Cloudinary (unsigned upload).
 * Returns an already-optimized URL (f_auto, q_auto baked in) ready to store in Firestore.
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

  // Bake f_auto (best format), q_auto (best quality/size tradeoff) and a
  // max width straight into the stored URL — no per-view math needed later,
  // and it's the single biggest lever for keeping bandwidth/credits low.
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,c_limit,w_1000/");
}

/**
 * Uploads multiple files in parallel, returns their optimized URLs.
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