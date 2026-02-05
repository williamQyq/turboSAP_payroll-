#!/usr/bin/env bun

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourceDir = path.resolve(__dirname, "../dist")
const targetDir = path.resolve(__dirname, "../../../../uploads/static")

async function exists(dir: string) {
  try {
    await fs.access(dir)
    return true
  } catch {
    return false
  }
}

async function copyDirectory(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(srcPath)
      await fs.symlink(link, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function main() {
  if (!(await exists(sourceDir))) {
    console.error(`source dist folder not found at ${sourceDir}`)
    process.exit(1)
  }

  await fs.rm(targetDir, { recursive: true, force: true })
  await copyDirectory(sourceDir, targetDir)
  console.log(`Copied web dist from ${sourceDir} to ${targetDir}`)
}

await main()
