import path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type PackageJson = {
  version: string;
  productName?: string;
};

type ReleaseArtifact = {
  fileName: string;
  objectName?: string;
  filePath: string;
  contentType: string;
  cacheControl: string;
};

const DEFAULT_UPDATES_PREFIX = "desktop/painel/win";
const DEFAULT_INSTALLER_ALIAS = "Painel - Portal Santos Tech Setup Latest.exe";

const electronRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(electronRoot, "..");
const releaseDir = path.join(electronRoot, "release");
const packageJsonPath = path.join(electronRoot, "package.json");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(electronRoot, ".env"), override: true });

function resolveRequiredValue(primaryKey: string, fallbackKey?: string) {
  const directValue = process.env[primaryKey]?.trim();
  if (directValue) return directValue;

  if (fallbackKey) {
    const fallbackValue = process.env[fallbackKey]?.trim();
    if (fallbackValue) return fallbackValue;
  }

  throw new Error(`Variavel obrigatoria ausente: ${primaryKey}`);
}

function normalizePrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, "");
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/g, "");
}

function toPublicFileName(artifact: ReleaseArtifact) {
  return artifact.objectName ?? artifact.fileName;
}

function isManagedReleaseObject(fileName: string) {
  return (
    fileName === "latest.yml" ||
    fileName.endsWith(".exe") ||
    fileName.endsWith(".exe.blockmap")
  );
}

function hasWindowsSigningConfigured() {
  return [
    process.env.CSC_LINK,
    process.env.CSC_KEY_PASSWORD,
    process.env.WIN_CSC_LINK,
    process.env.WIN_CSC_KEY_PASSWORD,
    process.env.CSC_NAME,
  ].some((value) => value?.trim());
}

function quoteWindowsShellArg(value: string) {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

async function runCommand(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const isWindowsCmd =
      process.platform === "win32" &&
      (/\.cmd$/i.test(command) || /\.bat$/i.test(command) || command === "npm");

    const finalCommand = isWindowsCmd ? process.env.ComSpec || "cmd.exe" : command;
    const finalArgs = isWindowsCmd
      ? [
          "/d",
          "/s",
          "/c",
          [command.replace(/\.(cmd|bat)$/i, ""), ...args].map(quoteWindowsShellArg).join(" "),
        ]
      : args;

    const child = spawn(finalCommand, finalArgs, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Comando falhou (${finalCommand} ${finalArgs.join(" ")}), exit code=${String(code)}`
        )
      );
    });
  });
}

async function readPackageJson() {
  const raw = await readFile(packageJsonPath, "utf8");
  return JSON.parse(raw) as PackageJson;
}

async function collectArtifacts(version: string) {
  if (!existsSync(releaseDir)) {
    throw new Error("Pasta release nao encontrada. O build do Electron nao foi gerado.");
  }

  const releaseEntries = await readdir(releaseDir, { withFileTypes: true });
  const files = releaseEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  const latestYml = files.find((fileName) => fileName === "latest.yml");
  const installer = files.find(
    (fileName) => fileName.endsWith(".exe") && fileName.includes(version) && !fileName.endsWith(".blockmap")
  );
  const blockmap = files.find(
    (fileName) => fileName.endsWith(".exe.blockmap") && fileName.includes(version)
  );

  if (!latestYml || !installer || !blockmap) {
    throw new Error(
      "Artefatos de release incompletos. Esperado: latest.yml, instalador .exe e .blockmap."
    );
  }

  const artifacts: ReleaseArtifact[] = [
    {
      fileName: installer,
      filePath: path.join(releaseDir, installer),
      contentType: "application/vnd.microsoft.portable-executable",
      cacheControl: "public, max-age=31536000, immutable",
    },
    {
      fileName: installer,
      objectName: DEFAULT_INSTALLER_ALIAS,
      filePath: path.join(releaseDir, installer),
      contentType: "application/vnd.microsoft.portable-executable",
      cacheControl: "no-cache, no-store, must-revalidate",
    },
    {
      fileName: blockmap,
      filePath: path.join(releaseDir, blockmap),
      contentType: "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    },
    {
      fileName: latestYml,
      filePath: path.join(releaseDir, latestYml),
      contentType: "text/yaml; charset=utf-8",
      cacheControl: "no-cache, no-store, must-revalidate",
    },
  ];

  return artifacts;
}

async function uploadArtifacts(
  client: S3Client,
  bucket: string,
  prefix: string,
  publicBaseUrl: string,
  artifacts: ReleaseArtifact[]
) {
  for (const artifact of artifacts) {
    const publicFileName = toPublicFileName(artifact);
    const objectKey = `${prefix}/${publicFileName}`;
    console.log(`Enviando ${artifact.fileName} -> ${objectKey}`);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: createReadStream(artifact.filePath),
        ContentType: artifact.contentType,
        CacheControl: artifact.cacheControl,
      })
    );

    console.log(`Publicado: ${publicBaseUrl}/${publicFileName}`);
  }
}

async function cleanupStaleArtifacts(
  client: S3Client,
  bucket: string,
  prefix: string,
  artifacts: ReleaseArtifact[]
) {
  const keepFiles = new Set(artifacts.map(toPublicFileName));
  const staleKeys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/`,
        ContinuationToken: continuationToken,
      })
    );

    for (const entry of response.Contents ?? []) {
      const key = entry.Key;
      if (!key) continue;
      const fileName = key.slice(prefix.length + 1);
      if (!fileName || !isManagedReleaseObject(fileName)) continue;
      if (keepFiles.has(fileName)) continue;
      staleKeys.push(key);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  if (staleKeys.length === 0) {
    console.log("Nenhum artefato antigo para remover no R2.");
    return;
  }

  for (let index = 0; index < staleKeys.length; index += 1000) {
    const chunk = staleKeys.slice(index, index + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: false,
        },
      })
    );
  }

  for (const key of staleKeys) {
    console.log(`Removido do R2: ${key}`);
  }
}

async function main() {
  const packageJson = await readPackageJson();
  const version = packageJson.version;
  if (!version) {
    throw new Error("Versao do package.json nao encontrada.");
  }

  const accountId = resolveRequiredValue("R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = resolveRequiredValue("R2_ACCESS_KEY_ID", "CLOUDFLARE_ACCESS_KEY_ID");
  const secretAccessKey = resolveRequiredValue(
    "R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_SECRET_ACCESS_KEY"
  );
  const bucket = resolveRequiredValue("R2_BUCKET", "CLOUDFLARE_BUCKET_NAME");
  const prefix = normalizePrefix(process.env.DESKTOP_UPDATES_PREFIX?.trim() || DEFAULT_UPDATES_PREFIX);
  const publicBaseUrl = normalizeBaseUrl(
    process.env.DESKTOP_UPDATES_PUBLIC_URL?.trim() ||
      `${resolveRequiredValue("CLOUDFLARE_PUBLIC_URL")}/${prefix}`
  );
  const endpoint = normalizeBaseUrl(
    process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`
  );

  console.log(`Gerando release ${version} de ${packageJson.productName ?? "Electron App"}...`);
  if (!hasWindowsSigningConfigured()) {
    console.warn(
      "Aviso: nenhuma credencial de assinatura Windows foi encontrada. O instalador sera gerado sem assinatura confiavel."
    );
  }

  const npmCommand = "npm";
  await runCommand(npmCommand, ["run", "dist:win"], electronRoot);

  const artifacts = await collectArtifacts(version);
  const s3 = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await uploadArtifacts(s3, bucket, prefix, publicBaseUrl, artifacts);
  await cleanupStaleArtifacts(s3, bucket, prefix, artifacts);

  console.log("");
  console.log(`Release ${version} publicada com sucesso.`);
  console.log(`Feed esperado: ${publicBaseUrl}/latest.yml`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
