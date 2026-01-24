#!/usr/bin/env node

const fs = require("fs");
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

function getBinaryPackage() {
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

  return packageName;
}

function getBinaryPath() {
  const packageName = getBinaryPackage();

  try {
    // Try to resolve the platform-specific package
    const packagePath = require.resolve(`${packageName}/package.json`);
    const packageDir = path.dirname(packagePath);
    const pkg = require(packagePath);

    // Get binary name from package
    const binaryName = pkg.bin
      ? Object.values(pkg.bin)[0]
      : "t3-mono" + (os.platform() === "win32" ? ".exe" : "");

    return path.join(packageDir, binaryName);
  } catch (e) {
    console.error(`Failed to find binary package: ${packageName}`);
    console.error("Please report this issue at: https://github.com/elijahross/boilerplate_moduls/issues");
    process.exit(1);
  }
}

function linkBinary() {
  const binaryPath = getBinaryPath();
  const binDir = path.join(__dirname, "bin");
  const linkPath = path.join(binDir, "t3-mono" + (os.platform() === "win32" ? ".exe" : ""));

  // Ensure bin directory exists
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  // Create symlink or copy binary
  try {
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }

    if (os.platform() === "win32") {
      // On Windows, copy the binary
      fs.copyFileSync(binaryPath, linkPath);
    } else {
      // On Unix, create a symlink
      fs.symlinkSync(binaryPath, linkPath);
    }

    // Make executable
    fs.chmodSync(linkPath, 0o755);
  } catch (e) {
    console.error("Failed to link binary:", e.message);
    process.exit(1);
  }
}

// Run installation
linkBinary();
