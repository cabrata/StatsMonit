const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const { getStats } = require("./lib/stats.js");
require("dotenv").config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server)

app.use(express.static("public"))

const clients = new Set()

setInterval(async () => {
  const stats = await getStats()
  for (const socket of clients) {
    socket.emit("stats", stats)
  }
}, 3000)

io.on("connection", (socket) => {
  clients.add(socket)

  // Kirim data awal saat pertama connect
  ;(async () => {
    const stats = await getStats()
    socket.emit("stats", stats)
  })()

  // Hapus dari daftar saat disconnect
  socket.on("disconnect", () => {
    clients.delete(socket)
  })
})


const PORT = process.env.PORT || 8088
server.listen(PORT, () => {
  console.log(`The Server Is Running On http://localhost:${PORT}`)
})
