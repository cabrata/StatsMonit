const si = require('systeminformation');
const os = require("os");
const disk = require("diskusage");
const { OSUtils } = require('node-os-utils');
const osu = new OSUtils();
const fs = require("fs").promises;
const path = require("path");
const { formatBytes } = require("./utils");

// Store historical data for timeline graphs
const historyLimit = 20; // Number of data points to keep in history
let cpuHistory = [];
let memoryHistory = [];
let networkHistory = [];

async function getDiskStats(path = "/") {
  try {
    const { available, free, total } = await disk.check(path);
    const used = total - free;
    const usedPercent = ((used / total) * 100).toFixed(2);
    return {
      path,
      total: formatBytes(total),
      used: formatBytes(used),
      available: formatBytes(available),
      usedPercent: `${usedPercent}%`,
    };
  } catch (err) {
    console.error(`Error getting disk stats for path "${path}":`, err);
    return null;
  }
}

async function getNetworkStats() {
  const stats = await osu.netstat.stats();

  // Handle unsupported or unexpected return types
  if (!Array.isArray(stats)) {
    return [];
  }

  // Calculate total input/output for history
  let totalInput = 0;
  let totalOutput = 0;

  const interfaces = stats.map((iface) => {
    totalInput += Number.parseInt(iface.inputBytes) || 0;
    totalOutput += Number.parseInt(iface.outputBytes) || 0;

    return {
      interface: iface.interface,
      inputBytes: formatBytes(iface.inputBytes),
      outputBytes: formatBytes(iface.outputBytes),
      totalBytes: formatBytes(Number.parseInt(iface.inputBytes) + Number.parseInt(iface.outputBytes)),
      rawInputBytes: Number.parseInt(iface.inputBytes) || 0,
      rawOutputBytes: Number.parseInt(iface.outputBytes) || 0,
    };
  });

  // Add to network history
  const timestamp = new Date().toISOString();
  networkHistory.push({
    timestamp,
    input: totalInput,
    output: totalOutput
  });

  // Trim history if needed
  if (networkHistory.length > historyLimit) {
    networkHistory.shift();
  }

  return interfaces;
}

async function getTemperatureInfo() {
  try {
    const tempData = await si.cpuTemperature();

    if (tempData && typeof tempData.main === 'number' && !isNaN(tempData.main)) {
      return `${tempData.main.toFixed(1)}°C`;
    } else {
      console.warn("Temperature data not available.");
      return null;
    }
  } catch (err) {
    console.error("Error getting temperature information:", err);
    return null;
  }
}


// Get Node.js heap memory statistics
async function getHeapStats() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: formatBytes(memoryUsage.rss),
    heapTotal: formatBytes(memoryUsage.heapTotal),
    heapUsed: formatBytes(memoryUsage.heapUsed),
    external: formatBytes(memoryUsage.external),
    arrayBuffers: formatBytes(memoryUsage.arrayBuffers || 0),
    rawHeapUsed: memoryUsage.heapUsed,
    rawHeapTotal: memoryUsage.heapTotal,
    heapUsedPercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2)
  };
}

// Get process count
async function getProcessCount() {
  try {
    const processes = await si.processes();
    return {
      all: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping
     };
  } catch (err) {
    console.error("Error getting process count:", err);
    return { all: 0, running: 0, blocked: 0, sleeping: 0 };
  }
}

// Get file system info
async function getFileSystemInfo() {
  try {
    const fsSize = await si.fsSize();
    if (fsSize && fsSize.length > 0) {
      const rootFs = fsSize.find(fs => fs.mount === '/' || fs.mount === 'C:') || fsSize[0];
      return {
        type: rootFs.fsType || 'Unknown',
        inodes: rootFs.inodes ? `${rootFs.inodes.used}/${rootFs.inodes.total}` : 'N/A',
        blocksize: rootFs.blocksize ? `${formatBytes(rootFs.blocksize)}` : 'N/A',
        mount: rootFs.mount || 'Unknown'
      };
    }
    return { type: 'Unknown', inodes: 'N/A', blocksize: 'N/A', mount: 'Unknown' };
  } catch (err) {
    console.error("Error getting file system info:", err);
    return { type: 'Unknown', inodes: 'N/A', blocksize: 'N/A', mount: 'Unknown' };
  }
}

// Get network speed (bytes per second)
let lastNetworkStats = null;
let networkSpeedHistory = [];

async function getNetworkSpeed() {
  try {
    const currentStats = await si.networkStats();
    if (!currentStats || currentStats.length === 0) {
      return { download: '0 KB/s', upload: '0 KB/s', downloadRaw: 0, uploadRaw: 0 };
    }

    // Calculate total bytes for all interfaces
    let totalRxBytes = 0;
    let totalTxBytes = 0;
    
    currentStats.forEach(iface => {
      totalRxBytes += iface.rx_bytes || 0;
      totalTxBytes += iface.tx_bytes || 0;
    });

    if (lastNetworkStats) {
      const timeDiff = 1; // Assuming 1 second interval
      const downloadSpeed = (totalRxBytes - lastNetworkStats.rx) / timeDiff;
      const uploadSpeed = (totalTxBytes - lastNetworkStats.tx) / timeDiff;

      // Add to history for smoothing
      networkSpeedHistory.push({
        download: Math.max(0, downloadSpeed),
        upload: Math.max(0, uploadSpeed),
        timestamp: Date.now()
      });

      // Keep only last 5 measurements for averaging
      if (networkSpeedHistory.length > 5) {
        networkSpeedHistory.shift();
      }

      // Calculate average speed
      const avgDownload = networkSpeedHistory.reduce((sum, item) => sum + item.download, 0) / networkSpeedHistory.length;
      const avgUpload = networkSpeedHistory.reduce((sum, item) => sum + item.upload, 0) / networkSpeedHistory.length;

      lastNetworkStats = { rx: totalRxBytes, tx: totalTxBytes };

      return {
        download: `${formatBytes(avgDownload)}/s`,
        upload: `${formatBytes(avgUpload)}/s`,
        downloadRaw: avgDownload,
        uploadRaw: avgUpload
      };
    } else {
      lastNetworkStats = { rx: totalRxBytes, tx: totalTxBytes };
      return { download: '0 KB/s', upload: '0 KB/s', downloadRaw: 0, uploadRaw: 0 };
    }
  } catch (err) {
    console.error("Error getting network speed:", err);
    return { download: '0 KB/s', upload: '0 KB/s', downloadRaw: 0, uploadRaw: 0 };
  }
}

// Get battery status
async function getBatteryStatus() {
  try {
    const battery = await si.battery();
    if (battery && battery.hasBattery) {
      return {
        level: battery.percent || 0,
        isCharging: battery.isCharging || false,
        timeLeft: battery.timeRemaining || 0,
        voltage: battery.voltage || 0,
        cycleCount: battery.cycleCount || 0
      };
    }
    return null;
  } catch (err) {
    console.error("Error getting battery status:", err);
    return null;
  }
}

// Get system time
function getSystemTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString(),
    date: now.toLocaleDateString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: now.toISOString()
  };
}

exports.getStats = async function getStats() {
  const memData = await si.mem();
  const totalMem = memData.total;
  const usedMem = memData.active;
  const usedMemPercent = ((usedMem / totalMem) * 100).toFixed(2);
  const uptime = os.uptime();
  const cpuUsage = await osu.cpu.usage();
  const cpus = os.cpus();
  const diskStats = await getDiskStats();
  const networkStats = await getNetworkStats();
  const tempInfo = await getTemperatureInfo();
  const heapStats = await getHeapStats();
  const processCount = await getProcessCount();
  const fileSystemInfo = await getFileSystemInfo();
  const networkSpeed = await getNetworkSpeed();
  const batteryStatus = await getBatteryStatus();
  const systemTime = getSystemTime();

  // Add to CPU history
  const timestamp = new Date().toISOString();
  cpuHistory.push({
    timestamp,
    usage: cpuUsage
  });

  // Add to memory history
  memoryHistory.push({
    timestamp,
    usage: parseFloat(usedMemPercent),
    used: usedMem,
    total: totalMem
  });

  // Trim histories if needed
  if (cpuHistory.length > historyLimit) {
    cpuHistory.shift();
  }

  if (memoryHistory.length > historyLimit) {
    memoryHistory.shift();
  }

  return {
    cpu: `${cpuUsage.toFixed(2)}%`,
    cpu_name: cpus[0]?.model || "Unknown",
    ram: `${usedMemPercent}%`,
    uptime,
    ram_text: `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${usedMemPercent}%)`,
    platform: os.platform(),
    architecture: os.arch(),
    cpu_cores: cpus.length,
    hostname: os.hostname(),
    load_average: os.loadavg(),
    temperature: tempInfo,
    disk: diskStats,
    network: networkStats,
    // Add history data for timeline graphs
    cpu_history: cpuHistory,
    memory_history: memoryHistory,
    network_history: networkHistory,
    // Add Node.js heap statistics
    heap: heapStats,
    process_count: processCount,
    file_system_info: fileSystemInfo,
    network_speed: networkSpeed,
    battery_status: batteryStatus,
    system_time: systemTime
  };
};
