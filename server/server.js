const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "RadioWatch API is running" });
});

// Current heatmap data endpoint
app.get("/api/latest-data", async (req, res) => {
  try {
    const pythonPath = path.join(__dirname, "scripts", "venv", "bin", "python");

    const pythonScriptPath = path.join(__dirname, "scripts", "smap_mapper.py");

    // TODO: Remove when script is modified to download data itself
    const dataPath =
      process.env.SMAP_DATA_PATH ||
      "/Users/maxbeyer/Desktop/projects/playground/SMAP-RFI-Mapper/h5_input_files";

    // Get threshold from query params or use default
    const threshold = req.query.threshold || "310";

    console.log(`Processing SMAP data with threshold: ${threshold}K`);

    const python = spawn(pythonPath, [
      pythonScriptPath,
      dataPath, // TODO: Remove when script downloads data itself
      "--threshold",
      threshold,
    ]);

    let jsonOutput = "";
    let errorOutput = "";

    // Collect output from script
    python.stdout.on("data", (data) => {
      jsonOutput += data.toString();
    });

    // Collect error output
    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    // When script finishes
    python.on("close", (code) => {
      // If exited with error return it
      if (code !== 0) {
        console.error("Python script error:", errorOutput);
        return res.status(500).json({
          error: "Failed to process SMAP data",
          details: errorOutput,
        });
      }

      // Otherwise parse JSON and return that (or error if fails)
      try {
        const parsedData = JSON.parse(jsonOutput);
        console.log(`Found ${parsedData.points?.length || 0} data points`);
        res.json(parsedData);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        res.status(500).json({
          error: "Failed to parse Python script output",
          raw_output: jsonOutput,
        });
      }
    });

    python.on("error", (error) => {
      console.error("Failed to start Python script:", error);
      res.status(500).json({
        error: "Failed to start Python script",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
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

app.listen(PORT, () => {
  console.log(`RadioWatch server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Live data endpoint: http://localhost:${PORT}/api/latest-data`);
  console.log(`Demo endpoint: http://localhost:${PORT}/api/demo-data`);
});
