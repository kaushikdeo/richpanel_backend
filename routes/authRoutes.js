const router = require("express").Router();
const passport = require("passport");
const CLIENT_HOME_PAGE_URL = "https://fast-reef-15816.herokuapp.com";

// when login is successful, retrieve user info
router.get("/login/success", (req, res) => {
  if (req.user) {
    console.log(' INSIDE LOGIN/SUCCESS');
    res.json({
      success: true,
      message: "user has successfully authenticated",
      user: req.user,
      cookies: req.cookies
    });
  }
});

// when login failed, send failed msg
router.get("/login/failed", (req, res) => {
  console.log(' INSIDE LOGIN/FAILED');
  res.status(401).json({
    success: false,
    message: "user failed to authenticate."
  });
});

// When logout, redirect to client
router.get("/logout", (req, res) => {
  console.log(' INSIDE LOGOUT');
  req.logout();
  res.redirect(CLIENT_HOME_PAGE_URL);
});

// auth with twitter
router.get("/twitter", passport.authenticate("twitter"));

module.exports = router;