# Single-stage build for RadioWatch application
FROM python:3.11-slim

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Python dependencies first
COPY server/scripts/requirements.txt ./scripts/
RUN pip install --no-cache-dir -r scripts/requirements.txt

# Copy package files and install Node.js dependencies
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Copy client static files
COPY client/ ./public/

# Create cache directories
RUN mkdir -p cache/raw_files cache/processed

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV PYTHON_PATH=python

# Start the application
CMD ["npm", "start"]