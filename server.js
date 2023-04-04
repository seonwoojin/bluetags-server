const Koa = require("koa");
const Router = require("koa-router");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("@koa/cors");

const app = new Koa();
const router = new Router();

const PORT = process.env.PORT || 4000;

router.get("/api/test", (ctx) => {
  ctx.body = "Hello, World!";
});

const corsOptions = {
  origin: "*",
  Credential: true,
};

app.use(cors(corsOptions));
app.use(router.routes()).use(router.allowedMethods());

const server = http.createServer(app.callback());

const io = socketIO(server, {
  cors: {
    origin: ["http://localhost:3000", "https://www.bluetags.app"],
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

// Socket.io 이벤트 핸들러를 등록합니다.
io.on("connection", (socket) => {
  console.log("A user connected.");

  // 클라이언트와의 이벤트 핸들러를 등록합니다.
  socket.on("chat message", (msg) => {
    console.log("message: " + msg);
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected.");
  });
});

// 서버를 실행합니다.
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
