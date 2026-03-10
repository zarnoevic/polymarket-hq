#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const deployedAt = new Date().toISOString();

const content = `// Auto-generated at build time. Do not edit.
export const deployedAt = ${JSON.stringify(deployedAt)};
`;

const libDir = join(process.cwd(), "lib");
mkdirSync(libDir, { recursive: true });
writeFileSync(join(libDir, "build-info.generated.ts"), content);
