const passport = require("passport");
const TwitterStrategy = require("passport-twitter");
require('dotenv').config();

// serialize the user.id to save in the cookie session
// so the browser will remember the user when login
passport.serializeUser((user, done) => {
  done(null, {token: user.token, tokenSecret: user.tokenSecret, name: user.profile.screen_name});
});

// deserialize the cookieUserId to user in the database
passport.deserializeUser((user, done) => {
  done(null, user)
});

passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: "https://richpaneldash.herokuapp.com/twitter/callback"
    },
    async (token, tokenSecret, profile, done) => {
      done(null, {token, tokenSecret, profile});
    }
  )
);