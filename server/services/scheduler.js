const { spawn } = require("child_process");
const path = require("path");
const cron = require("node-cron");

class SMAPScheduler {
  constructor() {
    this.pythonPath = path.join(
      __dirname,
      "..",
      "scripts",
      "venv",
      "bin",
      "python"
    );
    this.fetcherScript = path.join(
      __dirname,
      "..",
      "scripts",
      "smap_fetcher.py"
    );
    this.mapperScript = path.join(__dirname, "..", "scripts", "smap_mapper.py");
    this.cacheDir = path.join(__dirname, "..", "cache");
    this.isRunning = false;
  }

  async runPythonScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
      console.log(`Running: ${scriptPath} ${args.join(" ")}`);

      const python = spawn(this.pythonPath, [scriptPath, ...args]);

      let stdout = "";
      let stderr = "";

      python.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        // Log non-JSON output
        if (!output.includes("DOWNLOAD_SUMMARY:")) {
          console.log(`[${path.basename(scriptPath)}]`, output.trim());
        }
      });

      python.stderr.on("data", (data) => {
        stderr += data.toString();
        console.error(
          `[${path.basename(scriptPath)} ERROR]`,
          data.toString().trim()
        );
      });

      python.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Script failed with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      python.on("error", (error) => {
        reject(error);
      });
    });
  }

  parseFetcherOutput(output) {
    // Look for DOWNLOAD_SUMMARY: line in output
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.startsWith("DOWNLOAD_SUMMARY:")) {
        try {
          const jsonStr = line.replace("DOWNLOAD_SUMMARY:", "").trim();
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error("Failed to parse fetcher output:", e);
          return null;
        }
      }
    }
    return null;
  }

  async updateSMAPData() {
    if (this.isRunning) {
      console.log("Update already running, skipping...");
      return;
    }

    this.isRunning = true;
    console.log("=== Starting SMAP data update ===");

    try {
      console.log("Fetching new SMAP files...");
      const fetcherArgs = [
        "--cache-dir",
        path.join(this.cacheDir, "raw_files"),
        "--manifest",
        path.join(this.cacheDir, "manifest.json"),
        "--cleanup",
      ];

      const fetcherOutput = await this.runPythonScript(
        this.fetcherScript,
        fetcherArgs
      );
      const summary = this.parseFetcherOutput(fetcherOutput);

      if (!summary) {
        throw new Error("Failed to parse fetcher output");
      }

      console.log(
        `Fetcher completed: ${summary.new_files} new files, ${summary.total_files} total`
      );

      // Process data if new files
      if (summary.new_files > 0) {
        console.log("Processing new data...");

        const mapperArgs = [
          path.join(this.cacheDir, "raw_files"),
          "--threshold",
          "310",
        ];

        await this.runPythonScript(this.mapperScript, mapperArgs);
        console.log("Data processing completed");
      } else {
        console.log("No new files, skipping processing");
      }

      console.log("=== SMAP data update completed successfully ===");
    } catch (error) {
      console.error("=== SMAP data update failed ===");
      console.error("Error:", error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    console.log("Starting SMAP scheduler...");

    // Run once on startup
    console.log("Running initial data update...");
    this.updateSMAPData().catch((err) => {
      console.error("Initial update failed:", err.message);
    });

    // Schedule to run every hour at minute 0
    cron.schedule("0 * * * *", () => {
      console.log("Scheduled SMAP update triggered");
      this.updateSMAPData().catch((err) => {
        console.error("Scheduled update failed:", err.message);
      });
    });

    console.log("SMAP scheduler started");
  }

  // Manual trigger
  async triggerUpdate() {
    console.log("Manual update triggered");
    return await this.updateSMAPData();
  }
}

module.exports = SMAPScheduler;
