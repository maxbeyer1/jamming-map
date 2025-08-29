# RadioWatch - An OSINT SMAP-based Geopolitical Monitor

A web application for visualizing and analyzing temperature anomalies from NASA's SMAP satellite data as potential geopolitical activity/evidence of signal jamming. Uses the fact that SMAP records the 1.4 GHz spectrum (used for GPS, drone signals, etc. and not much for anything civilian related), so anyone broadcasting extremely high temperatures is probably trying to jam signals.

Live Website: http://radiowatch.org

_Built for Northwestern CS 396_

## Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- NASA Earthdata account (register at https://urs.earthdata.nasa.gov/users/new)
- Google Maps Static API key (https://developers.google.com/maps/documentation/maps-static/get-api-key)

### Setup

1. **Copy .env.example file:**

   ```bash
   cp .env.example .env
   ```

   _Graders: See `GRADING_NOTE.txt` for a ready-to-go `.env` file._

2. **Edit `.env` with your credentials:**

   ```bash
   EARTHDATA_USERNAME=your_username_here
   EARTHDATA_PASSWORD=your_password_here
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. **Run with Docker:**

   ```bash
   docker compose up --build
   ```

4. **Access the application:**
   - http://localhost (web interface)
   - http://localhost/api (API endpoint)
