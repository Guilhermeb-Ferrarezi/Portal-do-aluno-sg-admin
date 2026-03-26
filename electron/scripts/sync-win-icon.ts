import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const electronRoot = path.resolve(__dirname, "..");
const pngPath = path.join(electronRoot, "assets", "icon.png");
const icoPath = path.join(electronRoot, "assets", "icon.ico");

function assertPng(buffer: Buffer) {
  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (!signature.equals(expected)) {
    throw new Error("O arquivo de origem do icone nao e um PNG valido.");
  }
}

function readPngDimensions(buffer: Buffer) {
  assertPng(buffer);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  if (!width || !height) {
    throw new Error("Nao foi possivel ler as dimensoes do icon.png.");
  }

  return { width, height };
}

function createIcoFromPng(buffer: Buffer) {
  const { width, height } = readPngDimensions(buffer);
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);
  iconDir.writeUInt16LE(1, 2);
  iconDir.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(buffer.length, 8);
  entry.writeUInt32LE(iconDir.length + entry.length, 12);

  return Buffer.concat([iconDir, entry, buffer]);
}

async function main() {
  const pngBuffer = await readFile(pngPath);
  const icoBuffer = createIcoFromPng(pngBuffer);
  await writeFile(icoPath, icoBuffer);
  console.log(`Icone Windows atualizado em ${icoPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
