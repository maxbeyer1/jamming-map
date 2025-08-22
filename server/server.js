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

// Helper function to parse date from processed filename (processed_YYYYMMDD_HHMMSS.json)
function parseDateFromFilename(filename) {
  const match = filename.match(/processed_(\d{8})_\d{6}\.json/);
  if (!match) return null;

  const dateStr = match[1]; // YYYYMMDD
  const year = parseInt(dateStr.substr(0, 4));
  const month = parseInt(dateStr.substr(4, 2)) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substr(6, 2));

  return new Date(year, month, day);
}

// Helper function to get all processed files within a date range
function getProcessedFilesInRange(fromDate, toDate) {
  const processedDir = path.join(__dirname, "cache", "processed");

  if (!fs.existsSync(processedDir)) {
    return [];
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);

  // Set time to start/end of day for proper comparison
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const files = fs
    .readdirSync(processedDir)
    .filter((file) => file.startsWith("processed_") && file.endsWith(".json"))
    .map((file) => {
      const fileDate = parseDateFromFilename(file);
      if (!fileDate) return null;

      return {
        name: file,
        path: path.join(processedDir, file),
        date: fileDate,
        timestamp: file.match(/processed_(\d{8}_\d{6})\.json/)?.[1] || "0",
      };
    })
    .filter((file) => file && file.date >= from && file.date <= to);

  return files;
}

// Helper function to group files by date and select latest per day
function groupFilesByDate(files) {
  const grouped = {};

  files.forEach((file) => {
    const dateKey = file.date.toISOString().split("T")[0]; // YYYY-MM-DD

    if (!grouped[dateKey] || file.timestamp > grouped[dateKey].timestamp) {
      grouped[dateKey] = file;
    }
  });

  return Object.values(grouped).sort((a, b) => a.date - b.date);
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

// Satellite image URL endpoint
app.get("/api/satellite-image-url", (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Both 'lat' and 'lon' parameters are required",
      });
    }

    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

    // Return placeholder if no API key configured
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE") {
      return res.json({
        url: "https://placehold.co/200x150?text=Configure+API+Key",
        placeholder: true,
      });
    }

    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=15&size=200x150&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;

    res.json({
      url: url,
      placeholder: false,
    });
  } catch (error) {
    console.error("Error generating satellite image URL:", error);
    res.status(500).json({
      error: "Failed to generate satellite image URL",
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

// Historical data endpoint
app.get("/api/historical-data", async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: "Missing required parameters",
        message:
          "Both 'from' and 'to' date parameters are required (YYYY-MM-DD format)",
      });
    }

    // Get all files in the date range
    const filesInRange = getProcessedFilesInRange(from, to);

    if (filesInRange.length === 0) {
      return res.status(404).json({
        error: "No data available",
        message: `No processed data found for date range ${from} to ${to}`,
        dateRange: { from, to },
      });
    }

    // Group by date and select latest per day
    const latestFilesByDate = groupFilesByDate(filesInRange);

    // Build response data
    const timePoints = [];

    for (const fileInfo of latestFilesByDate) {
      try {
        const fileData = JSON.parse(fs.readFileSync(fileInfo.path, "utf8"));

        timePoints.push({
          date: fileInfo.date.toISOString().split("T")[0], // YYYY-MM-DD
          displayDate: fileInfo.date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          points: fileData.points || [],
          stats: fileData.stats || {},
        });
      } catch (error) {
        console.warn(
          `Failed to read processed file ${fileInfo.name}:`,
          error.message
        );
        // Skip this file and continue with others
      }
    }

    if (timePoints.length === 0) {
      return res.status(500).json({
        error: "Failed to load data",
        message: "Found files but couldn't read any data from them",
      });
    }

    console.log(
      `Served historical data: ${timePoints.length} time points from ${from} to ${to}`
    );

    res.json({
      timePoints: timePoints,
      dateRange: { from, to },
    });
  } catch (error) {
    console.error("Error serving historical data:", error);
    res.status(500).json({
      error: "Failed to load historical data",
      details: error.message,
    });
  }
});

scheduler.start();

app.listen(PORT, () => {
  console.log(`RadioWatch server running on port ${PORT}`);
  console.log(`API live at http://localhost:${PORT}/api`);
});
