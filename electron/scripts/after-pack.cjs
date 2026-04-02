const fs = require("node:fs");
const path = require("node:path");
const { readdir } = require("node:fs/promises");
const rcedit = require("rcedit");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const iconPath = path.join(__dirname, "..", "assets", "icon.ico");
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Icone Windows nao encontrado em ${iconPath}`);
  }

  const configuredExecutableName =
    context.packager.platformSpecificBuildOptions?.executableName?.trim() ||
    context.packager.appInfo.productFilename;

  let executablePath = path.join(context.appOutDir, `${configuredExecutableName}.exe`);
  if (!fs.existsSync(executablePath)) {
    const entries = await readdir(context.appOutDir, { withFileTypes: true });
    const fallbackExecutable = entries.find(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe")
    );

    if (!fallbackExecutable) {
      throw new Error(`Nenhum executavel .exe encontrado em ${context.appOutDir}`);
    }

    executablePath = path.join(context.appOutDir, fallbackExecutable.name);
  }

  const productName = context.packager.appInfo.productName || configuredExecutableName;
  const companyName = context.packager.appInfo.companyName?.trim() || "Santos Tech";
  const version = context.packager.appInfo.version;
  const originalFilename = path.basename(executablePath);

  await rcedit(executablePath, {
    icon: iconPath,
    "file-version": version,
    "product-version": version,
    "requested-execution-level": "asInvoker",
    "version-string": {
      CompanyName: companyName,
      FileDescription: productName,
      InternalName: configuredExecutableName,
      OriginalFilename: originalFilename,
      ProductName: productName,
    },
  });

  console.log(`Icone e metadados aplicados em ${executablePath}`);
};
