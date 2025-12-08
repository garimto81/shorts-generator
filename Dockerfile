# Shorts Generator - Docker Image
# Editly + FFmpeg for video generation

FROM node:18-bullseye

# Install system dependencies for canvas, gl, and ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libgl1-mesa-dev \
    libxi-dev \
    libxext-dev \
    pkg-config \
    build-essential \
    python3 \
    python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create output directory
RUN mkdir -p /app/output /app/temp

# Set environment variables
ENV NODE_ENV=production

# Default command
ENTRYPOINT ["node", "src/index.js"]
CMD ["--help"]
