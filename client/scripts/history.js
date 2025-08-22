let map;
let heatLayer;
let markersLayer;
let historicalData = null;
let currentTimeIndex = 15; // Middle of timeline
let loadDataTimeout = null; // For debouncing date changes

function initMap() {
  map = L.map("map", {
    zoomControl: false,
  }).setView([30, 0], 2);

  createDarkBasemap().addTo(map);

  markersLayer = L.layerGroup().addTo(map);

  // Make map global var
  window.map = map;
}

// Validate that date inputs are complete and valid
function validateDateInputs() {
  const dateFrom = document.getElementById("date-from").value;
  const dateTo = document.getElementById("date-to").value;

  // Check if both dates are present and in YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !dateFrom ||
    !dateTo ||
    !dateRegex.test(dateFrom) ||
    !dateRegex.test(dateTo)
  ) {
    return {
      valid: false,
      error: "Please enter complete dates in both fields",
      showError: false,
    }; // Don't show while typing
  }

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);

  // Check if dates are valid
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return { valid: false, error: "Please enter valid dates", showError: true };
  }

  // Check if from date is before to date
  if (fromDate > toDate) {
    return {
      valid: false,
      error: "Start date must be before end date",
      showError: true,
    };
  }

  return { valid: true, fromDate: dateFrom, toDate: dateTo };
}

// Show error message in UI instead of alert
function showErrorMessage(message) {
  const errorContainer = document.getElementById("date-error-message");
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = "block";

    // Auto-remove after 5 seconds
    setTimeout(clearErrorMessage, 5000);
  }
}

function clearErrorMessage() {
  const errorContainer = document.getElementById("date-error-message");
  if (errorContainer) {
    errorContainer.style.display = "none";
    errorContainer.textContent = "";
  }
}

// Load historical data from backend
async function loadHistoricalData() {
  try {
    clearErrorMessage();

    const validation = validateDateInputs();
    if (!validation.valid) {
      console.log("Validation failed:", validation.error);
      if (validation.showError) {
        showErrorMessage(validation.error);
      }
      return;
    }

    showLoading(true);
    console.log(
      `Loading historical data from ${validation.fromDate} to ${validation.toDate}`
    );

    const response = await fetch(
      `/api/historical-data?from=${validation.fromDate}&to=${validation.toDate}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to load data");
    }

    const data = await response.json();
    console.log(`Loaded ${data.timePoints?.length || 0} time points`);

    historicalData = data;

    // Reset timeline position to middle
    currentTimeIndex = Math.floor((data.timePoints?.length || 1) / 2);

    updateTimelineLabels();
    updateMapForCurrentTime();
    updateTimestamp();
  } catch (error) {
    console.error("Error loading historical data:", error);
    showErrorMessage(`Failed to load historical data: ${error.message}`);
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
    // Real data below copied from Python generated heatmap example
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
      opacity: 0.5,
      fillOpacity: 0.25,
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

// Debounced date range change handler
function onDateRangeChange() {
  console.log("Date range changed");

  // Clear any existing timeout
  if (loadDataTimeout) {
    clearTimeout(loadDataTimeout);
  }

  // Set new timeout to load data after user stops typing (500ms delay)
  loadDataTimeout = setTimeout(() => {
    loadHistoricalData();
  }, 500);
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

// function openSettings() {
//   alert("Settings panel will be implemented in future version");
//   // TODO: Is this needed? Might remove
// }

// Set smart default dates based on current date
function setDefaultDates() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // Format as YYYY-MM-DD
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // Only set defaults if inputs are empty
  const dateFromInput = document.getElementById("date-from");
  const dateToInput = document.getElementById("date-to");

  if (!dateFromInput.value) {
    dateFromInput.value = thirtyDaysAgoStr;
  }

  if (!dateToInput.value) {
    dateToInput.value = todayStr;
  }
}

// Init everything on load
document.addEventListener("DOMContentLoaded", function () {
  initMap();

  // Set default dates
  setDefaultDates();

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

  // Load historical data from backend with default dates
  loadHistoricalData();
});
