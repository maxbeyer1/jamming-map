// Common variables

// TODO: REMOVE THIS AND MOVE TO BACKEND
// Key is restricted but still bad practice
const GOOGLE_MAPS_API_KEY = "AIzaSyAxGvWHl0BZANLg29kWOjVN6OauyfSgg2Q";

const BACKEND_URL = "/api";

// Get satellite imagery URL w/ Google Maps Static API
function getSatelliteImageUrl(lat, lon) {
  // Return placeholder if no API key configured
  // TODO: Remove once backend is set up
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE") {
    return "https://placehold.co/200x150?text=Configure+API+Key";
  }

  return (
    `https://maps.googleapis.com/maps/api/staticmap?` +
    `center=${lat},${lon}&` +
    `zoom=15&` +
    `size=200x150&` +
    `maptype=satellite&` +
    `key=${GOOGLE_MAPS_API_KEY}`
  );
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

// Initialize base map (TODO: Add light mode?)
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
