const cookieSession = require("cookie-session");
const express = require("express");
const http = require('http');
const passport = require("passport");
const passportSetup = require("./config/passportTwitterConfig");
const session = require("express-session");
const authRoutes = require("./routes/authRoutes");
const cors = require("cors");
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser"); // parse cookie header
const Twit = require('twit');
const {ApolloServer, PubSub} = require('apollo-server-express');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
require('dotenv').config();
const webhookConfig = require('./config/webhookConfig');

const app = express();

const port = process.env.PORT || 4000;
const pubsub = new PubSub();
const loadDB = require('./connection');

app.use(
  cookieSession({
    name: "session",
    // TODO: shift to ENV
    keys: [process.env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 100
  })
);

app.use(
  cors({
    origin: "https://fast-reef-15816.herokuapp.com", // allow to server to accept request from different origin
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true // allow session cookie from browser to pass through
  }),
  bodyParser.json({ limit: '50mb' }),
  bodyParser.urlencoded({ extended: true }),
);

// parse cookies
app.use(cookieParser());

// initalize passport
app.use(passport.initialize());
// deserialize cookie from the browser
app.use(passport.session());

// set up routes
app.use("/auth", authRoutes);

const authCheck = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({
      authenticated: false,
      message: "user has not been authenticated"
    });
  } else {
    next();
  }
};

app.get("/", authCheck, (req, res) => {
  res.setHeader('Set-Cookie', [`token=${req.user.token}`, `tokenSecret=${req.user.tokenSecret}`, `userName=${req.user.tokenSecret}`]);
  res.status(200).json({
    authenticated: true,
    message: "user successfully authenticated",
    user: req.user,
    cookies: req.cookies
  });
});

app.get("twitter/webhook", (req, res) => {
  webhookConfig.getHandler(req, res);
})

app.post("/twitter/webhook", (req,res) => {
  console.log('HELLO', req.body);
})

app.get(
  "/twitter/callback",
  passport.authenticate("twitter", {
    successRedirect: "https://fast-reef-15816.herokuapp.com",
    failureRedirect: "/auth/login/failed"
  })
);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true,
  context: async ({ req, connection }) => {
    const client = await loadDB();
    const db = await client.db('richpaneldb');
    if (!req) {
      return{
        pubsub,
        db
      };
    } else {
      let T = null;
      if (req.headers.authtoken && req.headers.authtokensecret) {
        T = new Twit({
          consumer_key: process.env.TWITTER_CONSUMER_KEY,
          consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
          access_token: req.headers.authtoken,
          access_token_secret: req.headers.authtokensecret,
          timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
          strictSSL:            true,     // optional - requires SSL certificates to be valid.
        });
      }
      const client = await loadDB();
      const db = await client.db('richpaneldb');
      return {
        token: req.headers.authtoken,
        tokenSecret: req.headers.authtokensecret,
        T,
        db,
        pubsub,
      };
    }
  },
});

server.applyMiddleware({ app, path: '/graphql' });
const httpServer = http.createServer(app);
server.installSubscriptionHandlers(httpServer);

// connect react to nodejs express server
httpServer.listen(port, () => console.log(`Server is running on port ${port}!`));