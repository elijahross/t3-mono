#!/usr/bin/env node

const { execFileSync, spawn } = require("child_process");
const path = require("path");
const os = require("os");

const PLATFORM_MAP = {
  darwin: {
    arm64: "@t3-mono/darwin-arm64",
    x64: "@t3-mono/darwin-x64",
  },
  linux: {
    x64: "@t3-mono/linux-x64",
    arm64: "@t3-mono/linux-arm64",
  },
  win32: {
    x64: "@t3-mono/win32-x64",
  },
};

function getBinaryPath() {
  const platform = os.platform();
  const arch = os.arch();

  const platformPackages = PLATFORM_MAP[platform];
  if (!platformPackages) {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
  }

  const packageName = platformPackages[arch];
  if (!packageName) {
    console.error(`Unsupported architecture: ${arch} on ${platform}`);
    process.exit(1);
  }

  try {
    const packagePath = require.resolve(`${packageName}/package.json`);
    const packageDir = path.dirname(packagePath);
    const binaryName = "t3-mono" + (platform === "win32" ? ".exe" : "");
    return path.join(packageDir, binaryName);
  } catch (e) {
    // Fallback to local binary (for development)
    const localBinary = path.join(
      __dirname,
      "..",
      "..",
      "target",
      "release",
      "t3-mono" + (platform === "win32" ? ".exe" : "")
    );

    const fs = require("fs");
    if (fs.existsSync(localBinary)) {
      return localBinary;
    }

    console.error(`Binary not found. Package: ${packageName}`);
    console.error("Try running: npm install");
    process.exit(1);
  }
}

// Get the binary path and run it with all arguments
const binaryPath = getBinaryPath();
const args = process.argv.slice(2);

const child = spawn(binaryPath, args, {
  stdio: "inherit",
  shell: false,
});

child.on("error", (err) => {
  console.error("Failed to start binary:", err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
