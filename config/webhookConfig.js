const crypto = require("crypto");

function createCrcResponseToken(crcToken) {
  const hmac = crypto
    .createHmac("sha256", process.env.TWITTER_CONSUMER_SECRET)
    .update(crcToken)
    .digest("base64");

  return `sha256=${hmac}`;
};

function getHandler(req, res) {
  const crcToken = req.query.crc_token;

  if (crcToken) {
    res.status(200).send({
      response_token: createCrcResponseToken(crcToken)
    });
  } else {
    res.status(400).send({
      message: "Error: crc_token missing from request."
    });
  }
}

module.exports = {
  getHandler,
}