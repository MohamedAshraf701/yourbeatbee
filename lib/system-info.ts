import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"

import {
  type SystemSnapshot,
  recommendModels,
} from "@/lib/models"
import { projectRoot } from "@/lib/paths"

function ramGb(): number {
  try {
    if (process.platform === "darwin") {
      const pages = Number(
        execSync("sysctl -n hw.memsize", { encoding: "utf8" }).trim()
      )
      if (Number.isFinite(pages) && pages > 0) {
        return pages / (1024 ** 3)
      }
    }
  } catch {
    // fall through
  }
  return os.totalmem() / (1024 ** 3)
}

function detectCudaVramGb(): number | null {
  try {
    const out = execSync(
      "nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits",
      { encoding: "utf8", timeout: 3000 }
    ).trim()
    const first = Number(out.split("\n")[0]?.trim())
    if (Number.isFinite(first) && first > 0) {
      return first / 1024 // MiB → GiB approx when nvidia reports MiB
    }
  } catch {
    // no nvidia-smi
  }
  return null
}

function detectDevice(): SystemSnapshot["device"] {
  if (process.platform === "darwin" && os.arch() === "arm64") {
    return "mps"
  }
  try {
    execSync("nvidia-smi", { stdio: "ignore", timeout: 2000 })
    return "cuda"
  } catch {
    return "cpu"
  }
}

export function probeSystem(): SystemSnapshot {
  const root = projectRoot()
  const vendor = path.join(root, "vendor", "ACE-Step-1.5")
  const heart = path.join(root, "vendor", "heartlib")
  const heartCkpt = path.join(heart, "ckpt")
  const rvc = path.join(root, "vendor", "rvc-env", "pyproject.toml")
  const device = detectDevice()
  const cudaVramGb = device === "cuda" ? detectCudaVramGb() : null
  const backend: SystemSnapshot["backend"] =
    device === "mps" ? "mlx" : "pt"

  const heartmulaReady =
    (existsSync(path.join(heart, "pyproject.toml")) ||
      existsSync(path.join(heart, "setup.py")) ||
      existsSync(path.join(heart, ".git"))) &&
    existsSync(path.join(heartCkpt, "HeartMuLa-oss-3B")) &&
    existsSync(path.join(heartCkpt, "HeartCodec-oss")) &&
    (existsSync(path.join(heartCkpt, "tokenizer.json")) ||
      existsSync(path.join(heartCkpt, "gen_config.json")))

  return {
    os: `${process.platform} ${os.release()}`,
    arch: os.arch(),
    ramGb: Math.round(ramGb() * 10) / 10,
    device,
    backend,
    cudaVramGb,
    vendorReady:
      existsSync(path.join(vendor, ".git")) ||
      existsSync(path.join(vendor, "pyproject.toml")),
    heartmulaReady,
    rvcReady: existsSync(rvc),
  }
}

export function probeSystemWithRecommendation() {
  const system = probeSystem()
  const recommendation = recommendModels(system)
  return { system, recommendation }
}

export function projectHasVendor() {
  return probeSystem().vendorReady
}
