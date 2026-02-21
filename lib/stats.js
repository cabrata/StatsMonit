const si = require('systeminformation');
const os = require("os");
// Hapus 'diskusage' karena v2.0 sudah mendukungnya secara native
const { OSUtils } = require('node-os-utils');
const fs = require("fs").promises;
const path = require("path");
const { formatBytes } = require("./utils");

// Inisialisasi instance OSUtils baru dengan fitur caching aktif
// Ini membantu mengurangi beban CPU jika fungsi dipanggil sangat sering
const osutils = new OSUtils({
  cacheEnabled: true,
  cacheTTL: 2000, 
});

// Store historical data for timeline graphs
const historyLimit = 20;
let cpuHistory = [];
let memoryHistory = [];
let networkHistory = [];

async function getDiskStats(mountPath = "/") {
  try {
    const result = await osutils.disk.usageByMountPoint(mountPath);
    if (result.success && result.data) {
      const { total, used, available, usagePercentage } = result.data;
      return {
        path: mountPath,
        // Konversi DataSize object ke bytes angka biasa
        total: formatBytes(total.toBytes()),
        used: formatBytes(used.toBytes()),
        available: formatBytes(available.toBytes()),
        usedPercent: `${usagePercentage.toFixed(2)}%`,
      };
    }
    return null;
  } catch (err) {
    console.error(`Error getting disk stats for path "${mountPath}":`, err);
    return null;
  }
}

async function getNetworkStats() {
  const result = await osutils.network.statsAsync();
  
  // Handle jika tidak sukses
  if (!result.success) return [];

  let totalInput = 0;
  let totalOutput = 0;

  const interfaces = result.data.map((iface) => {
    const input = iface.rxBytes ? iface.rxBytes.toBytes() : 0;
    const output = iface.txBytes ? iface.txBytes.toBytes() : 0;

    totalInput += input;
    totalOutput += output;

    return {
      interface: iface.interface,
      inputBytes: formatBytes(input),
      outputBytes: formatBytes(output),
      totalBytes: formatBytes(input + output),
      rawInputBytes: input,
      rawOutputBytes: output,
    };
  });

  const timestamp = new Date().toISOString();
  networkHistory.push({ timestamp, input: totalInput, output: totalOutput });
  if (networkHistory.length > historyLimit) networkHistory.shift();

  return interfaces;
}

async function getTemperatureInfo() {
  try {
    // Tetap menggunakan systeminformation karena dukungan temperatur hardware 
    // lintas platform (Linux/Windows) di node-os-utils v2.0 masih dilabeli 'Limited'
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

async function getProcessCount() {
  const result = await osutils.process.stats();
  if (result.success) {
    return {
      all: result.data.total,
      running: result.data.running,
      blocked: result.data.stopped || 0,
      sleeping: result.data.sleeping || 0
    };
  }
  return { all: 0, running: 0, blocked: 0, sleeping: 0 };
}

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

let lastNetworkStats = null;
let networkSpeedHistory = [];

async function getNetworkSpeed() {
  try {
    const result = await osutils.network.statsAsync();
    if (!result.success || result.data.length === 0) {
      return { download: '0 KB/s', upload: '0 KB/s', downloadRaw: 0, uploadRaw: 0 };
    }

    let totalRxBytes = 0;
    let totalTxBytes = 0;
    
    result.data.forEach(iface => {
      totalRxBytes += iface.rxBytes ? iface.rxBytes.toBytes() : 0;
      totalTxBytes += iface.txBytes ? iface.txBytes.toBytes() : 0;
    });

    if (lastNetworkStats) {
      const timeDiff = 1; 
      const downloadSpeed = (totalRxBytes - lastNetworkStats.rx) / timeDiff;
      const uploadSpeed = (totalTxBytes - lastNetworkStats.tx) / timeDiff;

      networkSpeedHistory.push({
        download: Math.max(0, downloadSpeed),
        upload: Math.max(0, uploadSpeed),
        timestamp: Date.now()
      });

      if (networkSpeedHistory.length > 5) networkSpeedHistory.shift();

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
  // Menggunakan Promise.all untuk mengambil API osutils secara konkuren agar lebih cepat
  const [memRes, cpuUsageRes, cpuInfoRes, uptimeRes] = await Promise.all([
    osutils.memory.info(),
    osutils.cpu.usage(),
    osutils.cpu.info(),
    osutils.system.uptime()
  ]);

  const totalMem = memRes.success ? memRes.data.total.toBytes() : 0;
  const usedMem = memRes.success ? memRes.data.used.toBytes() : 0;
  const usedMemPercent = memRes.success ? memRes.data.usagePercentage.toFixed(2) : "0.00";

  const cpuUsage = cpuUsageRes.success ? cpuUsageRes.data : 0;
  const cpuName = cpuInfoRes.success ? cpuInfoRes.data.model : os.cpus()[0]?.model || "Unknown";
  const cpuCores = cpuInfoRes.success ? cpuInfoRes.data.cores : os.cpus().length;
  
  // v2.0 uptime mengembalikan nilai milidetik, konversi ke detik seperti bawaan os.uptime()
  const uptime = uptimeRes.success ? Math.floor(uptimeRes.data.uptime / 1000) : os.uptime();

  const diskStats = await getDiskStats();
  const networkStats = await getNetworkStats();
  const tempInfo = await getTemperatureInfo();
  const heapStats = await getHeapStats();
  const processCount = await getProcessCount();
  const fileSystemInfo = await getFileSystemInfo();
  const networkSpeed = await getNetworkSpeed();
  const batteryStatus = await getBatteryStatus();
  const systemTime = getSystemTime();

  const timestamp = new Date().toISOString();
  cpuHistory.push({ timestamp, usage: cpuUsage });
  memoryHistory.push({ timestamp, usage: parseFloat(usedMemPercent), used: usedMem, total: totalMem });

  if (cpuHistory.length > historyLimit) cpuHistory.shift();
  if (memoryHistory.length > historyLimit) memoryHistory.shift();

  return {
    cpu: `${cpuUsage.toFixed(2)}%`,
    cpu_name: cpuName,
    ram: `${usedMemPercent}%`,
    uptime,
    ram_text: `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${usedMemPercent}%)`,
    platform: os.platform(),
    architecture: os.arch(),
    cpu_cores: cpuCores,
    hostname: os.hostname(),
    load_average: os.loadavg(),
    temperature: tempInfo,
    disk: diskStats,
    network: networkStats,
    cpu_history: cpuHistory,
    memory_history: memoryHistory,
    network_history: networkHistory,
    heap: heapStats,
    process_count: processCount,
    file_system_info: fileSystemInfo,
    network_speed: networkSpeed,
    battery_status: batteryStatus,
    system_time: systemTime
  };
};
