const Koa = require("koa");
const Router = require("koa-router");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("@koa/cors");
const bodyParser = require("koa-bodyparser");
const webpush = require("web-push");
const { default: axios } = require("axios");
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

let subscriptions = [];

router.post("/api/subscribe", async (ctx) => {
  const subscription = ctx.request.body;
  const requestApiSecret = ctx.request.header["x-api-secret"];
  if (process.env.API_KEY !== requestApiSecret) {
    ctx.throw(403, "Forbidden");
  }
  if (!subscriptions.some((sub) => sub.endpoint === subscription.endpoint)) {
    subscriptions.push(subscription);
    await axios.post(
      "https://www.bluetags.app/api/admin/create-subscription",
      subscription,
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
        },
      }
    );
  }
  ctx.status = 200;
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
  // 클라이언트와의 이벤트 핸들러를 등록합니다.
  socket.on("chat message", async (msg) => {
    try {
      for (let data of subscriptions) {
        try {
          await webpush.sendNotification(data, JSON.stringify(msg));
        } catch (error) {
          await axios.post(
            "https://www.bluetags.app/api/admin/delete-subscription",
            { endpoint: data.endpoint },
            {
              headers: {
                Authorization: `Bearer ${process.env.API_KEY}`,
              },
            }
          );
          subscriptions = subscriptions.filter(
            (sub) => sub.endpoint !== data.endpoint
          );
        }
      }
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected.");
  });
});

// 서버를 실행합니다.
server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  const prevSub = await axios.get(
    "https://www.bluetags.app/api/admin/subscriptions",
    {
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
      },
    }
  );
  subscriptions = prevSub.data.subscriptions;
});
