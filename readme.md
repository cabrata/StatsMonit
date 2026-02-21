# StatsMonit

[![License: MIT](https://img.shields.io/github/license/cabrata/statsmonit)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js->=18.x-brightgreen.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-linux%20|%20windows%20|%20macos-lightgrey)](#features)
[![Node.js CI](https://github.com/cabrata/statsmonit/actions/workflows/nodejs.yml/badge.svg)](https://github.com/cabrata/statsmonit/actions/workflows/nodejs.yml)

[![GitHub Stars](https://img.shields.io/github/stars/cabrata/statsmonit?style=social)](https://github.com/cabrata/statsmonit/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/cabrata/statsmonit?style=social)](https://github.com/cabrata/statsmonit/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/cabrata/statsmonit)](https://github.com/cabrata/statsmonit/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/cabrata/statsmonit)](https://github.com/cabrata/statsmonit/pulls)

**StatsMonit** is a lightweight server monitoring tool built with **Node.js** and **Socket.io**. It provides real-time system statistics, including **CPU usage, RAM usage, disk space, network activity**, and **uptime**.

## Demo
[![Image](https://api.microlink.io/?url=https%3A%2F%2Fstatsmonit-demo.caliph.dev&amp;screenshot=true&amp;meta=false&amp;embed=screenshot.url&amp;overlay.browser=dark&amp;waitForTimeout=30000&amp;overlay.background=linear-gradient(90deg%2C%20%23FF9A8B%200%25%2C%20%23FF6A88%2055%25%2C%20%23FF99AC%20100%25))](https://statsmonit-demo.caliph.dev)


## Features

- **Real-time Monitoring**: Get live updates every 3 seconds.
- **CPU Usage**: Shows CPU load percentage and model details.
- **Memory Usage**: Displays RAM consumption with detailed usage statistics.
- **Temperature**: Displays CPU temperature in real-time 
- **Disk Statistics**: Provides total, used, and available disk space.
- **Network Traffic**: Monitors incoming and outgoing network activity.
- **Cross-platform**: Works on Linux, Windows, and macOS.

## Installation

### Prerequisites
- **Node.js** (v18 or higher)
- **NPM** (comes with Node.js)
- **g++** (to compile some packages)
- **cmake** (to compile some packages)

### Steps
1. Clone this repository:
   ```bash
   git clone https://github.com/cabrata/statsmonit
   ```

2. Navigate into the project folder:

   ```bash
   cd statsmonit
   ```
3. Install dependencies:

   ```bash
   npm install
   ```
4. (Optional) Configure environment variables:
   Create a `.env` file and specify the port (default: `8088`).

   ```env
   PORT=8088
   ```

## Usage

### Using Docker (Recommended)

You can easily run StatsMonit using Docker.

1. Using **Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```

2. Using **Docker CLI**:
   ```bash
   docker build -t statsmonit .
   docker run -d -p 8088:8088 --name statsmonit statsmonit
   ```

### Start the Server (Manual)

Run the following command to start the monitoring service:

```bash
npm start
```

or manually using:

```bash
node index.js
```

### Access the Dashboard

Once the server is running, open your browser and visit:

```
http://localhost:8088
```

The server will continuously send system statistics to the client using **WebSockets (Socket.io)**.

## How It Works

1. **Server Setup**

   * Uses **Express.js** to serve static files.
   * Runs an **HTTP server** with **Socket.io** for real-time communication.

2. **Data Collection**

   * Uses **OS module** to fetch CPU, RAM, and system details.
   * Uses **diskusage** to check disk space.
   * Uses **systeminformation** to get CPU temperature data
   * Uses **node-os-utils** to fetch CPU and network statistics.

3. **Real-time Updates**

   * The server collects system stats every **3 seconds**.
   * Data is sent to connected clients via **WebSockets**.

## 🏗 Build Tailwind CSS

If you are using **Tailwind CSS** for styling, you can compile the CSS using:

```bash
npm run build
```

This will generate a minified CSS file for production.

## 🤝 Contributing

Contributions are welcome! Feel free to **open an issue** or **submit a pull request** if you find any improvements or bugs.

## 📜 License

This project is licensed under the **MIT License**.
