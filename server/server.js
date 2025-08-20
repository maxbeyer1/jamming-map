const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const SMAPScheduler = require("./services/scheduler");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, "public")));

// Init scheduler
const scheduler = new SMAPScheduler();

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "RadioWatch API is running" });
});

function getLatestProcessedFile() {
  const processedDir = path.join(__dirname, "cache", "processed");

  if (!fs.existsSync(processedDir)) {
    return null;
  }

  const files = fs
    .readdirSync(processedDir)
    .filter((file) => file.startsWith("processed_") && file.endsWith(".json"))
    .map((file) => ({
      name: file,
      path: path.join(processedDir, file),
      // Extract timestamp from filename for sorting
      timestamp: file.match(/processed_(\d{8}_\d{6})\.json/)?.[1] || "0",
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort descending (newest first)

  return files.length > 0 ? files[0] : null;
}

// Current heatmap data endpoint
app.get("/api/latest-data", async (req, res) => {
  try {
    const latestFile = getLatestProcessedFile();

    if (!latestFile) {
      return res.status(404).json({
        error: "No processed data available",
        message: "Use /api/update",
      });
    }

    // Check if file exists and read it
    if (!fs.existsSync(latestFile.path)) {
      return res.status(404).json({
        error: "Latest data file not found",
        filename: latestFile.name,
      });
    }

    const data = JSON.parse(fs.readFileSync(latestFile.path, "utf8"));

    // Add metadata about the file
    const stats = fs.statSync(latestFile.path);
    data.metadata = {
      filename: latestFile.name,
      fileTimestamp: latestFile.timestamp,
      lastModified: stats.mtime,
      dataAge: Date.now() - stats.mtime.getTime(),
    };

    console.log(
      `Served data from ${latestFile.name} (${data.points?.length || 0} points)`
    );
    res.json(data);
  } catch (error) {
    console.error("Error serving latest data:", error);
    res.status(500).json({
      error: "Failed to load processed data",
      details: error.message,
    });
  }
});

app.post("/api/update", async (req, res) => {
  try {
    console.log("Manual update requested");

    // Don't await - let it run in background and return immediately
    scheduler.triggerUpdate().catch((err) => {
      console.error("Manual update failed:", err.message);
    });

    res.json({
      status: "success",
      message: "Update triggered - check logs for progress",
    });
  } catch (error) {
    console.error("Error triggering update:", error);
    res.status(500).json({
      error: "Failed to trigger update",
      details: error.message,
    });
  }
});

app.get("/api/status", (req, res) => {
  try {
    const latestFile = getLatestProcessedFile();
    const manifestPath = path.join(__dirname, "cache", "manifest.json");

    let manifestInfo = { files: [], last_updated: null };
    if (fs.existsSync(manifestPath)) {
      manifestInfo = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    }

    const status = {
      scheduler_running: true,
      latest_processed_file: latestFile
        ? {
            filename: latestFile.name,
            timestamp: latestFile.timestamp,
            age_minutes: latestFile
              ? Math.round(
                  (Date.now() - fs.statSync(latestFile.path).mtime.getTime()) /
                    (1000 * 60)
                )
              : null,
          }
        : null,
      raw_files_count: manifestInfo.files.length,
      last_fetch: manifestInfo.last_updated,
      cache_directories: {
        raw_files: fs.existsSync(path.join(__dirname, "cache", "raw_files")),
        processed: fs.existsSync(path.join(__dirname, "cache", "processed")),
        manifest: fs.existsSync(manifestPath),
      },
    };

    res.json(status);
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({
      error: "Failed to get status",
      details: error.message,
    });
  }
});

// Demo data endpoint (for testing without Python script)
app.get("/api/demo-data", (req, res) => {
  const demoData = {
    points: [
      [34.17200469970703, 135.68580627441406, 311.50823974609375],
      [35.624549865722656, 136.9666748046875, 311.0556640625],
      [57.76116943359375, 61.802486419677734, 311.2349548339844],
      [57.648983001708984, 61.16133499145508, 325.14447021484375],
      [57.596229553222656, 61.359161376953125, 331.547607421875],
      [57.54594039916992, 61.558876037597656, 323.21881103515625],
      [39.97489929199219, 32.60314178466797, 310.7469787597656],
      [45.347408294677734, 38.739070892333984, 336.670166015625],
      [48.67844009399414, 35.49364471435547, 356.0020751953125],
      [29.96904945373535, 31.593303680419922, 318.28338623046875],
      [21.792835235595703, 101.70906829833984, 329.58990478515625],
      [22.633861541748047, 97.03102111816406, 355.1119384765625],
    ],
    stats: {
      total_points: 12,
      max_tb: 356.0,
      min_tb: 310.7,
      avg_tb: 328.4,
      threshold_used: 310,
    },
  };

  res.json(demoData);
});

scheduler.start();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RadioWatch server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Live data endpoint: http://localhost:${PORT}/api/latest-data`);
  console.log(`Demo endpoint: http://localhost:${PORT}/api/demo-data`);
});
