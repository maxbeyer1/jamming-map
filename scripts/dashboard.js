let map;
let heatLayer;
let markersLayer;
let currentData = null;
let allData = null;

// Init map
function initMap() {
  map = L.map("map", {
    zoomControl: false, // Allow custom controls
  }).setView([30, 0], 2);

  // Basemap
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  // Init markers layer
  markersLayer = L.layerGroup().addTo(map);

  // Map click handler for stats panel
  map.on("click", onMapClick);
}

// Functions for zoom buttons
function zoomIn() {
  map.zoomIn();
}

function zoomOut() {
  map.zoomOut();
}

// Refresh data
async function refreshData() {
  const refreshBtn = document.querySelector(".refresh");
  refreshBtn.style.transform = "rotate(360deg)";
  refreshBtn.style.transition = "transform 0.5s";

  setTimeout(() => {
    refreshBtn.style.transform = "";
    refreshBtn.style.transition = "";
  }, 500);

  await loadData();
}

// Filter data based on temperature threshold
function filterData() {
  const filter = document.getElementById("power-filter").value;

  if (!allData) return;

  let filteredPoints = allData.points;

  switch (filter) {
    case "elevated":
      filteredPoints = allData.points.filter((p) => p[2] >= 250 && p[2] < 300);
      break;
    case "high":
      filteredPoints = allData.points.filter((p) => p[2] >= 300 && p[2] < 350);
      break;
    case "critical":
      filteredPoints = allData.points.filter((p) => p[2] >= 350);
      break;
    default:
      filteredPoints = allData.points;
  }

  currentData = { ...allData, points: filteredPoints };
  updateMap();
  updateStats();
}

// Load data from backend (when it's ready)
async function loadData() {
  try {
    showLoading(true);

    const response = await fetch("/api/latest-data"); // or '/demo-data' for testing
    const data = await response.json();

    allData = data;
    currentData = data;

    updateMap();
    updateStats();
    updateTimestamp();

    showLoading(false);
  } catch (error) {
    console.error("Error loading data:", error);
    // Fallback - maybe replace with placeholder (?)
    loadDemoData();
  } finally {
    showLoading(false);
  }
}

// Demo data for testing (copied from generated heatmap)
function loadDemoData() {
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

  allData = demoData;
  currentData = demoData;

  updateMap();
  updateStats();
  updateTimestamp();

  showLoading(false);
}

// Update map with current data
function updateMap() {
  if (!currentData || !currentData.points.length) return;

  // Remove existing layers
  if (heatLayer) map.removeLayer(heatLayer);
  markersLayer.clearLayers();

  // Create heatmap
  heatLayer = L.heatLayer(currentData.points, {
    radius: 15,
    blur: 20,
    maxZoom: 10,
    gradient: {
      0.0: "#000080",
      0.3: "#0080ff",
      0.5: "#ffff00",
      0.7: "#ff8000",
      1.0: "#ff0000",
    },
  }).addTo(map);

  // Markers for individual points
  currentData.points.forEach((point) => {
    const [lat, lon, temp] = point;
    const tempClass = getTemperatureClass(temp);

    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      fillColor: getTemperatureColor(temp),
      color: "#000",
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.8,
    });

    marker.bindPopup(`
            <strong>Temperature Anomaly</strong><br>
            Coordinates: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°<br>
            Temperature: ${temp.toFixed(1)} K<br>
            Classification: ${tempClass}
          `);

    marker.on("click", () => updateLocationDetails(lat, lon, temp));

    markersLayer.addLayer(marker);
  });
}

// Refresh stats panel
function updateStats() {
  if (!currentData) return;

  document.getElementById("total-value").textContent =
    currentData.points.length;

  if (currentData.points.length > 0) {
    const temps = currentData.points.map((p) => p[2]); // Get temperatures from data (last index in arr)
    // Calculate stats
    const maxTemp = Math.max(...temps);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;

    // Update display
    document.getElementById("temp-value").innerHTML = `Max: ${maxTemp.toFixed(
      1
    )} K<br>Avg: ${avgTemp.toFixed(1)} K`;
  }
}

// Show details when user clicks on map
function updateLocationDetails(lat, lon, temp) {
  document.getElementById("coords-value").textContent = `${lat.toFixed(
    4
  )}° N, ${lon.toFixed(4)}° W`;

  const tempClass = getTemperatureClass(temp);
  const tempElement = document.getElementById("temp-value");
  tempElement.textContent = `${temp.toFixed(1)} K`;
  tempElement.className = `stats-value ${tempClass
    .toLowerCase()
    .replace(" ", "-")}-reading`;

  document.getElementById("time-value").textContent =
    new Date().toISOString().replace("T", " ").substr(0, 19) + " UTC";

  document.getElementById("data-summary").innerHTML = `
          <p><strong>Classification:</strong> ${tempClass}</p>
          <p><strong>Anomaly Level:</strong> ${getAnomalyLevel(temp)}</p>
          <p><strong>Confidence:</strong> ${Math.floor(
            Math.random() * 20 + 80
          )}%</p>
        `;
}

// Handle map click
function onMapClick(e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;
  updateLocationDetails(lat, lon, 0); // 0 temp for normal clicks
}

// Convert temp num to text
function getTemperatureClass(temp) {
  if (temp < 250) return "Normal";
  if (temp < 300) return "Elevated";
  if (temp < 350) return "High";
  return "Critical";
}

// Convert temp num to color
function getTemperatureColor(temp) {
  if (temp < 250) return "#000080";
  if (temp < 300) return "#0080ff";
  if (temp < 350) return "#ff8000";
  return "#ff0000";
}

function getAnomalyLevel(temp) {
  if (temp < 250) return "None";
  if (temp < 300) return "Low";
  if (temp < 350) return "Medium";
  return "High";
}

// Show or hide map loading indicator
// Show = true for show, false for hide
function showLoading(show) {
  document.getElementById("map-loading").style.display = show ? "flex" : "none";
}

function updateTimestamp() {
  // TODO: Replace with actual last updated instead of current time
  const now = new Date();
  const timeString =
    now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    }) +
    " " +
    now.toLocaleTimeString("en-US");

  document.getElementById(
    "last-update"
  ).textContent = `Last Update: ${timeString}`;
}

// Init when page loads
document.addEventListener("DOMContentLoaded", function () {
  initMap();
  loadDemoData(); // TODO: Replace with loadData() when backend is finished
});
