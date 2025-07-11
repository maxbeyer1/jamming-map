let map;
let heatLayer;
let markersLayer;
let historicalData = null;
let currentTimeIndex = 15; // Middle of timeline

function initMap() {
  map = L.map("map", {
    zoomControl: false,
  }).setView([30, 0], 2);

  createDarkBasemap().addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Make map global var
  window.map = map;
}

// Load historical data from backend
// TODO: Replace with real data this is mostly pseudocode
async function loadHistoricalData() {
  try {
    showLoading(true);

    const dateFrom = document.getElementById("date-from").value;
    const dateTo = document.getElementById("date-to").value;

    // TODO: Replace with real API endpoint
    const response = await fetch(
      `/api/historical-data?from=${dateFrom}&to=${dateTo}`
    );
    const data = await response.json();

    historicalData = data;
    updateTimelineLabels();
    updateMapForCurrentTime();
  } catch (error) {
    console.error("Error loading historical data:", error);
    // Fallback to demo data - again maybe switch to placeholder (what's better UX?)
    loadDemoHistoricalData();
  } finally {
    showLoading(false);
  }
}

// Demo historical data for testing
function loadDemoHistoricalData() {
  const startDate = new Date("2025-06-04");
  const timePoints = [];

  for (let i = 0; i < 31; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);

    // Generate demo points for each day with some variation
    // Data below copied from generated heatmap example
    const basePoints = [
      [34.17200469970703, 135.68580627441406, 311.5],
      [35.624549865722656, 136.9666748046875, 311.0],
      [57.76116943359375, 61.802486419677734, 311.2],
      [57.648983001708984, 61.16133499145508, 325.1],
      [39.97489929199219, 32.60314178466797, 310.7],
      [45.347408294677734, 38.739070892333984, 336.6],
      [48.67844009399414, 35.49364471435547, 356.0],
      [21.792835235595703, 101.70906829833984, 329.5],
      [22.633861541748047, 97.03102111816406, 355.1],
    ];

    // Change temps slightly over time to show changing data
    const points = basePoints.map(([lat, lon, temp]) => [
      lat,
      lon,
      temp + Math.sin(i * 0.2) * 10 + (Math.random() * 20 - 10),
    ]);

    timePoints.push({
      date: currentDate.toISOString().split("T")[0],
      displayDate: currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      points: points,
      stats: {
        total_points: points.length,
        max_tb: Math.max(...points.map((p) => p[2])),
        min_tb: Math.min(...points.map((p) => p[2])),
        avg_tb: points.reduce((sum, p) => sum + p[2], 0) / points.length,
      },
    });
  }

  historicalData = {
    timePoints: timePoints,
    dateRange: {
      from: "2025-06-04",
      to: "2025-07-04",
    },
  };

  updateTimelineLabels();
  updateMapForCurrentTime();
  updateTimestamp();

  showLoading(false);
}

// Update timeline labels based on loaded data
function updateTimelineLabels() {
  if (!historicalData) return;

  const slider = document.getElementById("time-slider");
  const timeStart = document.querySelector(".time-start");
  const timeEnd = document.querySelector(".time-end");
  // const currentTime = document.querySelector(".current-time");

  slider.max = historicalData.timePoints.length - 1;

  timeStart.textContent = historicalData.timePoints[0].displayDate;
  timeEnd.textContent =
    historicalData.timePoints[historicalData.timePoints.length - 1].displayDate;

  updateCurrentTimeDisplay();
}

function updateCurrentTimeDisplay() {
  if (!historicalData) return;

  const currentTime = document.querySelector(".current-time");
  const currentData = historicalData.timePoints[currentTimeIndex];

  if (currentData) {
    currentTime.textContent = `Current: ${currentData.displayDate}`;
  }
}

// Update map for current timeline spot
function updateMapForCurrentTime() {
  if (!historicalData || !historicalData.timePoints[currentTimeIndex]) return;

  const currentData = historicalData.timePoints[currentTimeIndex];

  // Remove existing layers
  if (heatLayer) map.removeLayer(heatLayer);
  markersLayer.clearLayers();

  // Apply new filter
  const filteredPoints = filterPointsByPowerLevel(currentData.points);

  if (filteredPoints.length === 0) return;

  // Create heatmap
  heatLayer = L.heatLayer(filteredPoints, {
    radius: 15,
    blur: 20,
    maxZoom: 10,
    gradient: HEATMAP_GRADIENT,
  }).addTo(map);

  // Add markers to heatmap
  filteredPoints.forEach((point) => {
    const [lat, lon, temp] = point;

    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      fillColor: getTemperatureColor(temp),
      color: "#000",
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.8,
    });

    marker.bindPopup(`
      <strong>Historical Anomaly</strong><br>
      Date: ${currentData.displayDate}<br>
      Coordinates: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°<br>
      Temperature: ${temp.toFixed(1)} K<br>
      Classification: ${getTemperatureClass(temp)}
    `);

    markersLayer.addLayer(marker);
  });
}

function filterPointsByPowerLevel(points) {
  const filter = document.getElementById("power-filter").value;

  // TODO: Consistent naming scheme for power levels
  switch (filter) {
    case "high": // Elevated >250K
      return points.filter((p) => p[2] >= 250 && p[2] < 300);
    case "extreme": // High >300K
      return points.filter((p) => p[2] >= 300 && p[2] < 350);
    case "critical": // Critical >350K
      return points.filter((p) => p[2] >= 350);
    default: // All levels
      return points;
  }
}

function onTimelineChange() {
  const slider = document.getElementById("time-slider");
  currentTimeIndex = parseInt(slider.value);

  updateCurrentTimeDisplay();
  updateMapForCurrentTime();
}

function onDateRangeChange() {
  console.log("Date range changed - TODO: reload data");
  //   loadHistoricalData();
}

// Power filter change handler
function filterData() {
  updateMapForCurrentTime();
}

async function refreshData() {
  const refreshBtn = document.querySelector(".refresh");
  refreshBtn.style.transform = "rotate(360deg)";
  refreshBtn.style.transition = "transform 0.5s";

  setTimeout(() => {
    refreshBtn.style.transform = "";
    refreshBtn.style.transition = "";
  }, 500);

  await loadHistoricalData();
}

function exportData() {
  alert("Export functionality will be implemented when backend is ready");
  // TODO: Implement CSV or other export of filtered data
}

function openSettings() {
  alert("Settings panel will be implemented in future version");
  // TODO: Is this needed? Might remove
}

// Init everything on load
document.addEventListener("DOMContentLoaded", function () {
  initMap();

  // Event listeners
  document
    .getElementById("time-slider")
    .addEventListener("input", onTimelineChange);
  document
    .getElementById("date-from")
    .addEventListener("change", onDateRangeChange);
  document
    .getElementById("date-to")
    .addEventListener("change", onDateRangeChange);
  document.querySelector(".export-btn").addEventListener("click", exportData);
  document
    .querySelector(".settings-btn")
    .addEventListener("click", openSettings);

  // Load demo data
  // TODO: Replace with loadHistoricalData when backend ready
  loadDemoHistoricalData();
});
