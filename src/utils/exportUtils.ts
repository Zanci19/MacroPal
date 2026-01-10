import { Capacitor, registerPlugin } from "@capacitor/core";

type FilesystemWriteOptions = {
  path: string;
  data: string;
  directory?: string;
};

type FilesystemGetUriOptions = {
  path: string;
  directory?: string;
};

type FilesystemPlugin = {
  writeFile(options: FilesystemWriteOptions): Promise<void>;
  getUri(options: FilesystemGetUriOptions): Promise<{ uri: string }>;
};

type SharePlugin = {
  share(options: { title?: string; url?: string }): Promise<void>;
};

const Filesystem = registerPlugin<FilesystemPlugin>("Filesystem");
const Share = registerPlugin<SharePlugin>("Share");

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected reader result"));
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });

export const shareOrDownload = async (file: File, fallbackName: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(file);
      const path = `${Date.now()}-${fallbackName}`;
      await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: "CACHE",
      });
      const uri = await Filesystem.getUri({ directory: "CACHE", path });
      await Share.share({ title: fallbackName, url: uri.uri });
      return;
    } catch (err) {
      console.warn("Native share failed, falling back to download:", err);
    }
  }

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: fallbackName,
      });
      return;
    } catch {
      // fall back to download
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
