const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ========== 1. 在这里填写全班普通学生信息 ==========
const studentData = [
  { zk5: "12345", ksId: "KS001", name: "张三" },
  { zk5: "54321", ksId: "KS002", name: "李四" },
  { zk5: "67890", ksId: "KS003", name: "王小花" },
  { zk5: "09876", ksId: "KS004", name: "刘浩然" },
  { zk5: "11223", ksId: "KS005", name: "陈雨桐" }
];

// ========== 2. 管理员账号（只有这里的人能清空画布，可多填） ==========
const adminList = [
  { zk5: "99999", ksId: "KS999", name: "班长管理员" },
  { zk5: "88888", ksId: "KS888", name: "班主任" }
];

// 合并所有登录用户
const allUserList = [...studentData, ...adminList];

// 云端涂鸦存储文件
const DATA_FILE = path.join(__dirname, "draw_data.json");
let allLines = [];

// 读取云端保存的涂鸦
function loadCloudData() {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    allLines = JSON.parse(raw);
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  }
}
// 自动保存涂鸦到云端
function saveCloudData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(allLines));
}
loadCloudData();

// 登录身份校验接口，返回是否管理员
app.get("/checkUser", (req, res) => {
  const zk5 = req.query.zk5;
  const ksId = req.query.ksId;
  const user = allUserList.find(s => s.zk5 === zk5 && s.ksId === ksId);
  if (!user) return res.json({ ok: false });
  const isAdmin = adminList.some(a => a.zk5 === zk5 && a.ksId === ksId);
  res.json({ ok: true, name: user.name, isAdmin: isAdmin });
});

// WebSocket实时同步
io.on("connection", (socket) => {
  let loginUserInfo = null;
  socket.emit("initCanvas", allLines);

  // 前端登录后上报身份
  socket.on("setUserInfo", (user) => {
    loginUserInfo = user;
  });

  // 接收新笔迹，广播给所有人并保存云端
  socket.on("drawLine", (line) => {
    allLines.push(line);
    saveCloudData();
    io.emit("newLine", line);
  });

  // 清空画布权限校验
  socket.on("clearAll", () => {
    if (!loginUserInfo || !loginUserInfo.isAdmin) {
      socket.emit("clearReject", "你不是管理员，无权清空画布");
      return;
    }
    allLines = [];
    saveCloudData();
    io.emit("clearCanvas");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`涂鸦墙服务运行端口: ${PORT}`);
});
