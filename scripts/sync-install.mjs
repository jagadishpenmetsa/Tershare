import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const src = join(root, "scripts", "install.ps1");
const dest = join(root, "apps", "web", "public", "install.ps1");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("Synced install.ps1 → apps/web/public/install.ps1");
const srcBat = join(root, 'scripts', 'install.bat');
const destBat = join(root, 'apps', 'web', 'public', 'install.bat');
copyFileSync(srcBat, destBat);
console.log('Synced install.bat ? apps/web/public/install.bat');
