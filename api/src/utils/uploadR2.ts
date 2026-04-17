import "../load-env";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: "auto",
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || "",
  },
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});

const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || "";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function extractKeyFromUrl(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    const keyFromPath = parsed.pathname.replace(/^\/+/, "");
    if (!keyFromPath) return null;

    const publicUrl = (process.env.CLOUDFLARE_PUBLIC_URL || "").trim();
    if (publicUrl) {
      const normalizedPublicUrl = normalizeBaseUrl(publicUrl);
      const normalizedFileUrl = normalizeBaseUrl(fileUrl);
      if (normalizedFileUrl.startsWith(normalizedPublicUrl + "/")) {
        return normalizedFileUrl.slice(normalizedPublicUrl.length + 1);
      }
    }

    if (parsed.hostname.endsWith(".r2.cloudflarestorage.com")) {
      return keyFromPath;
    }

    return null;
  } catch {
    return null;
  }
}

export function isR2ManagedUrl(fileUrl: string): boolean {
  const publicUrl = (process.env.CLOUDFLARE_PUBLIC_URL || "").trim();
  const normalizedFileUrl = normalizeBaseUrl(fileUrl);

  if (publicUrl) {
    const normalizedPublicUrl = normalizeBaseUrl(publicUrl);
    if (normalizedFileUrl.startsWith(normalizedPublicUrl + "/")) {
      return true;
    }
  }

  try {
    const parsed = new URL(fileUrl);
    return parsed.hostname.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}

/**
 * Upload de arquivo para CloudFlare R2
 * Retorna a URL pública do arquivo
 */
export async function uploadToR2(
  file: {
    originalname: string;
    buffer: Buffer;
    mimetype: string;
  },
  folder: string = "materiais",
  options?: {
    contentType?: string;
    extension?: string;
  }
): Promise<string> {
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error("Arquivo vazio");
  }

  // Gera nome único para o arquivo
  const fileExtension =
    options?.extension?.trim().replace(/^\.+/, "") ||
    file.originalname.split(".").pop() ||
    "bin";
  const uniqueFilename = `${folder}/${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: bucketName,
    Key: uniqueFilename,
    Body: file.buffer,
    ContentType: options?.contentType || file.mimetype || "application/octet-stream",
  };

  try {
    await s3Client.send(new PutObjectCommand(uploadParams));

    // Retorna URL pública usando domínio customizado do CloudFlare R2
    const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL || "";
    const fileUrl = `${publicUrl}/${uniqueFilename}`;
    return fileUrl;
  } catch (error) {
    throw new Error(`Erro ao fazer upload: ${error}`);
  }
}

/**
 * Deletar arquivo do CloudFlare R2
 */
export async function deleteFromR2(fileUrl: string): Promise<void> {
  try {
    const fileKey = extractKeyFromUrl(fileUrl);
    if (!fileKey) {
      throw new Error("URL inválida");
    }

    const deleteParams = {
      Bucket: bucketName,
      Key: fileKey,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));
  } catch (error) {
    console.error(`Erro ao deletar arquivo: ${error}`);
    // Não lança erro aqui para evitar quebrar a deleção do material se R2 falhar
  }
}
