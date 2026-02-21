# Use Node.js 20 Slim (Debian) as base image
FROM node:20-slim

# Install build dependencies and system utilities
# python3, make, g++, build-essential: for compiling native add-ons
# lm-sensors: provides sensors command
# dmidecode: provides system hardware info
# util-linux: provides lscpu
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    lm-sensors \
    dmidecode \
    util-linux \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build Tailwind CSS
RUN npm run build

# Expose the application port
EXPOSE 8088

# Start the application
CMD ["npm", "start"]
