// Convert temp num to text
function getTemperatureClass(temp) {
  if (temp < 250) return 'Normal';
  if (temp < 300) return 'Elevated';
  if (temp < 350) return 'High';
  return 'Critical';
}

// Convert temp num to color
function getTemperatureColor(temp) {
  if (temp < 250) return '#000080';
  if (temp < 300) return '#0080ff';
  if (temp < 350) return '#ff8000';
  return '#ff0000';
}

function getAnomalyLevel(temp) {
  if (temp < 250) return 'None';
  if (temp < 300) return 'Low';
  if (temp < 350) return 'Medium';
  return 'High';
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
  const loadingEl = document.getElementById('map-loading');
  if (loadingEl) {
    loadingEl.style.display = show ? 'flex' : 'none';
  }
}

function updateTimestamp() {
  // TODO: Replace with actual last updated instead of current time
  const now = new Date();
  const timeString = now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: '2-digit' 
  }) + ' ' + now.toLocaleTimeString('en-US');
  
  const updateEl = document.getElementById('last-update');
  if (updateEl) {
    updateEl.textContent = `Last Update: ${timeString}`;
  }
}

// Common heatmap gradient
const HEATMAP_GRADIENT = {
  0.0: '#000080',  // Blue for lower temps
  0.3: '#0080ff',  // Light blue
  0.5: '#ffff00',  // Yellow  
  0.7: '#ff8000',  // Orange
  1.0: '#ff0000'   // Red for highest temps
};

// Initialize dark basemap (reusable)
function createDarkBasemap() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  });
}