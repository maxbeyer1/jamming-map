# SMAP Signal Jamming Monitor

A web application for visualizing and analyzing temperature anomalies from NASA's SMAP satellite data as potential geopolitical activity/evidence of signal jamming. Uses the fact that SMAP records the 1.4 GHz spectrum (used for GPS, drone signals, etc. and not much for anything civilian related), so anyone broadcasting extremely high temperatures is probably trying to jam signals.

## Interactive Features

### Dashboard Page (`index.html`)

- **Interactive Heatmap**: Users can click on markers to open a popup with things like coordinates, temperature values, and classification levels
  - **Map Controls**:
    - Zoom in/out buttons for map navigation
    - Power level filter dropdown to show only elevated, high, or critical temperature readings (might change these levels)
- **Stats Panel**: Updates when clicking anywhere on the map to show:
  - Coordinates
  - Temperature reading and classification in words
  - Detection timestamp
  - Total marker count
  - Satellite imagery from Google Maps API based on clicked coordinates

### History Page (`history.html`)

- **Time Slider**: Users can navigate through historical data with a range slider showing available dates
  - Updates map data as you scroll
- **Date Range Controls**: Input fields to set date range
- **Data Filtering/Map Tools**: Same power level filtering and other tools as dashboard but for historical data

## Expected Behavior

Users can explore current and historical temperature anomalies by clicking on map markers to see detailed information, filter data by severity levels, or navigate through past data using the slider controls. Users get visual feedback through the color-coded heatmap and the stat panel which updates as they interact with the map.
