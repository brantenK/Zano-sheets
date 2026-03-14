#!/usr/bin/env node

/**
 * Test Setup Script for Zano Sheets
 * Helps verify test environment and run comprehensive test suites
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log("\n" + "=".repeat(60));
  log(title, "cyan");
  console.log("=".repeat(60) + "\n");
}

function runCommand(command, description) {
  try {
    log(`✓ ${description}`, "green");
    execSync(command, {
      cwd: rootDir,
      stdio: "inherit",
    });
    return true;
  } catch (error) {
    log(`✗ ${description}`, "red");
    return false;
  }
}

function checkFileExists(filePath) {
  return fs.existsSync(path.join(rootDir, filePath));
}

function checkTestEnvironment() {
  section("Checking Test Environment");

  const checks = [
    {
      name: "Vitest config",
      file: "vitest.config.ts",
      required: true,
    },
    {
      name: "Test directory",
      file: "tests",
      required: true,
    },
    {
      name: "Manual testing plan",
      file: "MANUAL-TESTING-PLAN.md",
      required: false,
    },
    {
      name: "Testing documentation",
      file: "docs/TESTING.md",
      required: false,
    },
  ];

  let allPassed = true;

  checks.forEach((check) => {
    const exists = checkFileExists(check.file);
    const icon = exists ? "✓" : "✗";
    const color = exists ? "green" : "red";
    const required = check.required ? " (required)" : "";

    log(`${icon} ${check.name}${required}`, color);

    if (!exists && check.required) {
      allPassed = false;
    }
  });

  return allPassed;
}

function countTestFiles() {
  const testsDir = path.join(rootDir, "tests");
  const files = fs.readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"));
  return files.length;
}

function runQuickTests() {
  section("Running Quick Tests (Unit Tests)");

  const commands = [
    { cmd: "pnpm test -- --run", desc: "Run all unit tests" },
  ];

  let passed = 0;
  let failed = 0;

  commands.forEach(({ cmd, desc }) => {
    if (runCommand(cmd, desc)) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log("\n");
  log(`Results: ${passed} passed, ${failed} failed`, failed > 0 ? "red" : "green");

  return failed === 0;
}

function runCoverageTests() {
  section("Running Coverage Tests");

  return runCommand("pnpm test -- --run --coverage", "Generate coverage report");
}

function runTypeCheck() {
  section("Running Type Check");

  return runCommand("pnpm typecheck", "TypeScript type check");
}

function runLint() {
  section("Running Lint");

  return runCommand("pnpm lint", "Biome lint check");
}

function generateTestReport() {
  section("Test Summary");

  const testCount = countTestFiles();
  log(`Total test files: ${testCount}`, "blue");

  const coverageDir = path.join(rootDir, "coverage");
  if (fs.existsSync(coverageDir)) {
    log(`Coverage report available in: coverage/`, "green");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command) {
    case "check":
      checkTestEnvironment();
      break;

    case "quick":
      runQuickTests();
      break;

    case "coverage":
      runCoverageTests();
      break;

    case "full":
      const checksPassed = checkTestEnvironment();
      if (!checksPassed) {
        log("Environment check failed. Please fix issues before running tests.", "red");
        process.exit(1);
      }

      const typeCheckPassed = runTypeCheck();
      const lintPassed = runLint();
      const testsPassed = runQuickTests();
      const coveragePassed = runCoverageTests();

      generateTestReport();

      const allPassed = typeCheckPassed && lintPassed && testsPassed && coveragePassed;

      if (allPassed) {
        log("\n✓ All checks passed!", "green");
        process.exit(0);
      } else {
        log("\n✗ Some checks failed. Please review the output above.", "red");
        process.exit(1);
      }

    case "watch":
      section("Running Tests in Watch Mode");
      runCommand("pnpm test -- --watch", "Watch mode");
      break;

    case "help":
    default:
      console.log(`
Test Setup Script for Zano Sheets

Usage: node scripts/test-setup.mjs <command>

Commands:
  check     - Verify test environment is set up correctly
  quick     - Run quick unit tests
  coverage  - Run tests with coverage report
  full      - Run complete test suite (typecheck, lint, tests, coverage)
  watch     - Run tests in watch mode
  help      - Show this help message

Examples:
  node scripts/test-setup.mjs check
  node scripts/test-setup.mjs quick
  node scripts/test-setup.mjs full
  node scripts/test-setup.mjs watch

See docs/TESTING.md for more information.
      `);
  }
}

main().catch((error) => {
  log(`Error: ${error.message}`, "red");
  process.exit(1);
});
