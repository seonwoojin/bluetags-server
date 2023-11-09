const Koa = require("koa");
const Router = require("koa-router");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("@koa/cors");
const bodyParser = require("koa-bodyparser");
const webpush = require("web-push");
const Verifier = require("google-play-billing-validator");
const { default: axios } = require("axios");
require("dotenv").config();

const app = new Koa();
const router = new Router();

const PORT = 8080;

const options = {
  email: process.env.CLIENT_EMAIL,
  key: process.env.PRIVATE_KEY,
};

const verifier = new Verifier(options);

router.get("/api/test", (ctx) => {
  ctx.body = "Hello, World!";
});

router.post("/api/validation/google/purchase", (ctx) => {
  let receipt = {
    packageName: ctx.request.body.purchase.packageNameAndroid,
    productId: ctx.request.body.purchase.productId,
    purchaseToken: ctx.request.body.purchase.purchaseToken,
  };

  let promiseData = verifier.verifyINAPP(receipt);

  promiseData
    .then(function (response) {
      console.log(response);
      // Yay! Purchase is valid
      // See response structure below
    })
    .then(function (response) {
      // Here for example you can chain your work if purchase is valid
      // eg. add coins to the user profile, etc
      // If you are new to promises API
      // Awesome docs: https://developers.google.com/web/fundamentals/primers/promises
    })
    .catch(function (error) {
      console.log(error);
      // Purchase is not valid or API error
      // See possible error messages below
    });

  ctx.status = 200;
});

router.post("/api/validation/google/subscription", (ctx) => {
  let receipt = {
    packageName: ctx.request.body.purchase.packageNameAndroid,
    productId: ctx.request.body.purchase.productId,
    purchaseToken: ctx.request.body.purchase.purchaseToken,
  };

  let promiseData = verifier.verifySub(receipt);

  promiseData
    .then(function (response) {
      console.log(response);
      // Yay! Purchase is valid
      // See response structure below
    })
    .then(function (response) {
      // Here for example you can chain your work if purchase is valid
      // eg. add coins to the user profile, etc
      // If you are new to promises API
      // Awesome docs: https://developers.google.com/web/fundamentals/primers/promises
    })
    .catch(function (error) {
      console.log(error);
      // Purchase is not valid or API error
      // See possible error messages below
    });

  ctx.status = 200;
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
      "https://www.bluetags.app/api/admin/subscriptions",
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

async function abc() {
  const btcPrice = await axios.get(
    "https://api.coinpaprika.com/v1/tickers/btc-bitcoin"
  );
  const ethPrice = await axios.get(
    "https://api.coinpaprika.com/v1/tickers/eth-ethereum"
  );

  await axios.post("https://www.bluetags.app/api/info/coin", {
    btcPrice: btcPrice.data,
    ethPrice: ethPrice.data,
  });
}

abc();

setInterval(async () => {
  await abc();
}, [600000]);

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
            `https://www.bluetags.app/api/admin/subscriptions/${data.endpoint}`,
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

  socket.on("join room", async (msg) => {
    try {
      console.log(msg);
      socket.join(msg);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("create user message", async (msg, done) => {
    try {
      io.to(msg.room).emit("create user message", msg);
      done();
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("create complete", async (msg) => {
    try {
      io.to(msg.communityId).emit("create complete", msg);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("create complete include image", async (msg) => {
    try {
      io.to(msg.communityId).emit("create complete include image", msg);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("create newscard", async (msg) => {
    try {
      io.emit("create newscard", msg);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("delete newscard", async (msg) => {
    try {
      io.emit("delete newscard", msg);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("create discord post", async (msg) => {
    try {
      console.log(typeof msg);
      await axios.post(
        "https://www.bluetags.app/api/admin/create-rawData",
        {
          data: JSON.stringify(msg),
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.API_KEY}`,
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("disconnect", () => {});
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
