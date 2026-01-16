type ResizeOptions = {
  maxSize?: number;
  mimeType?: string;
  quality?: number;
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };
    img.src = url;
  });

export const resizeImageFile = async (
  file: File,
  { maxSize = 720, mimeType = "image/jpeg", quality = 0.85 }: ResizeOptions = {}
): Promise<Blob> => {
  const image = await loadImage(file);
  const maxDimension = Math.max(image.width, image.height);
  const scale = maxDimension > maxSize ? maxSize / maxDimension : 1;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare image canvas.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to encode image."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
};

export const isDataUrl = (value: string) => value.startsWith("data:image/");

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const sanitizeFileName = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "")
    .toLowerCase() || "profile-photo";
