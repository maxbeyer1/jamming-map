// Common variables
const BACKEND_URL = "/api";

// Get satellite imagery URL via backend API
async function getSatelliteImageUrl(lat, lon) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/satellite-image-url?lat=${lat}&lon=${lon}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to get satellite image URL");
    }

    return data.url;
  } catch (error) {
    console.error("Failed to fetch satellite image URL:", error);
    return "https://placehold.co/200x150?text=Error+Loading+Image";
  }
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

// Common map utilities
function zoomIn() {
  if (window.map) window.map.zoomIn();
}

function zoomOut() {
  if (window.map) window.map.zoomOut();
}

// Show or hide map loading indicator
// Show = true for show, false for hide
function showLoading(show) {
  const loadingEl = document.getElementById("map-loading");
  if (loadingEl) {
    loadingEl.style.display = show ? "flex" : "none";
  }
}

async function updateTimestamp() {
  try {
    const response = await fetch(`${BACKEND_URL}/status`);
    const data = await response.json();

    let timeString;
    if (data.last_fetch) {
      const lastFetch = new Date(data.last_fetch);
      timeString =
        lastFetch.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        }) +
        " " +
        lastFetch.toLocaleTimeString("en-US");
    } else {
      timeString = "No data available";
    }

    const updateEl = document.getElementById("last-update");
    if (updateEl) {
      updateEl.textContent = `Last Update: ${timeString}`;
    }
  } catch (error) {
    console.error("Failed to fetch status:", error);
    const updateEl = document.getElementById("last-update");
    if (updateEl) {
      updateEl.textContent = "Last Update: Unable to fetch";
    }
  }
}

// Common heatmap gradient
const HEATMAP_GRADIENT = {
  0.0: "#000080", // Blue for lower temps
  0.3: "#0080ff", // Light blue
  0.5: "#ffff00", // Yellow
  0.7: "#ff8000", // Orange
  1.0: "#ff0000", // Red for highest temps
};

// Filter points by temperature level using consistent naming scheme
function filterPointsByTemperature(points, filterLevel) {
  if (!points) return [];
  
  switch (filterLevel) {
    case "elevated":
      return points.filter((p) => p[2] >= 250);
    case "high":
      return points.filter((p) => p[2] >= 300);
    case "critical":
      return points.filter((p) => p[2] >= 350);
    case "all":
    default:
      return points;
  }
}

// Initialize base map
function createDarkBasemap() {
  return L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  );
}
