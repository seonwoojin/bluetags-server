const Koa = require("koa");
const Router = require("koa-router");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("@koa/cors");
const bodyParser = require("koa-bodyparser");
const webpush = require("web-push");
require("dotenv").config();

const app = new Koa();
const router = new Router();

const PORT = 8080;

router.get("/api/test", (ctx) => {
  ctx.body = "Hello, World!";
});

const corsOptions = {
  origin: "*",
  Credential: true,
};

webpush.setVapidDetails(
  "mailto:example@yourdomain.org",
  process.env.APPLICATION_PUBLIC_KEY,
  process.env.APPLICATION_PRIVATE_KEY
);

app.use(bodyParser());
app.use(cors(corsOptions));
app.use(router.routes()).use(router.allowedMethods());

const subscriptions = [];

router.get("/api/key", (ctx) => {
  ctx.body = { key: process.env.APPLICATION_PUBLIC_KEY };
  ctx.status = 200;
});

router.post("/api/subscribe", (ctx) => {
  const subscription = ctx.request.body;
  console.log("Push Subscription:", subscription);
  subscriptions.push(subscription);
  ctx.status = 200;
});

router.get("/api/push", (ctx) => {
  const payload = "123123123";
  webpush
    .sendNotification(subscriptions[0], payload)
    .then(() => {
      ctx.status = 200;
    })
    .catch((error) => {
      console.error(error);
    });
});

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
  socket.on("chat message", async (msg) => {
    console.log("message: " + msg);
    io.emit("chat message", msg);
    try {
      await Promise.all(
        subscriptions.map((data) => {
          webpush
            .sendNotification(data, msg)
            .then(() => {})
            .catch((error) => {
              console.error(error);
            });
        })
      );
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected.");
  });
});

// 서버를 실행합니다.
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
