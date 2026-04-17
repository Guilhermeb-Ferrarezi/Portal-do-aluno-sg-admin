type SafeImageMimeType = "image/png" | "image/jpeg" | "image/webp";

type SafeImageFile = {
  contentType: SafeImageMimeType;
  extension: "png" | "jpg" | "webp";
};

const SAFE_IMAGE_MIME_TYPES: Record<SafeImageMimeType, SafeImageFile["extension"]> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function trimAsciiPrefix(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 256)).toString("utf8").trimStart().toLowerCase();
}

export function detectSafeImageMimeType(buffer: Buffer): SafeImageMimeType | null {
  if (buffer.length >= 8) {
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (isPng) return "image/png";
  }

  if (buffer.length >= 3) {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (isJpeg) return "image/jpeg";
  }

  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString("ascii") === "RIFF";
    const webp = buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (riff && webp) return "image/webp";
  }

  return null;
}

export function validateSafeImageFile(file: {
  buffer: Buffer;
  mimetype?: string;
}): SafeImageFile {
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error("Arquivo vazio");
  }

  const sniffedMimeType = detectSafeImageMimeType(file.buffer);
  const declaredMimeType = (file.mimetype || "").toLowerCase().trim();
  const prefix = trimAsciiPrefix(file.buffer);

  if (declaredMimeType === "image/svg+xml" || prefix.startsWith("<svg")) {
    throw new Error("Formato de imagem nao permitido");
  }

  if (!sniffedMimeType) {
    throw new Error("Arquivo de imagem invalido");
  }

  if (declaredMimeType && declaredMimeType !== sniffedMimeType) {
    throw new Error("Tipo de imagem nao confere com o conteudo enviado");
  }

  return {
    contentType: sniffedMimeType,
    extension: SAFE_IMAGE_MIME_TYPES[sniffedMimeType],
  };
}

export function isSafeHttpUrl(value: string) {
  const parsed = new URL(value);
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}
