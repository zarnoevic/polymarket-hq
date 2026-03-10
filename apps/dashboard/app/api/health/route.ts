import { execSync } from "node:child_process";
import { NextResponse } from "next/server";

function getCommitHash(): string | null {
  const fromEnv =
    process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

export async function GET() {
  const commit = getCommitHash();
  const short = commit ? commit.slice(0, 7) : "unknown";
  return NextResponse.json({
    status: "ok",
    app: "Polymarket HQ",
    version: short,
  });
}
