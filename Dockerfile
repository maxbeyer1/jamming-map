FROM python:3.12-slim

# Install Node
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY server/scripts/requirements.txt ./scripts/
RUN pip install --no-cache-dir -r scripts/requirements.txt

# Install Node deps
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server src
COPY server/ ./

# Copy client static files
COPY client/ ./public/

# Create cache directories
RUN mkdir -p cache/raw_files cache/processed

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV PYTHON_PATH=python

CMD ["npm", "start"]