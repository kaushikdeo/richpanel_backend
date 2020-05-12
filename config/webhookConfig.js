const { Autohook } = require('twitter-autohook');

let WebHook = null;

const addWebhook = async(token, tokenSecret) => {
  WebHook = new Autohook({
    token: token,
    token_secret: tokenSecret,
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    env: 'dev',
    port: 1337
  });
  //  Removes existing webhooks
  await WebHook.removeWebhooks();
  // Starts a server and adds a new webhook
  await WebHook.start();
};

module.exports = {
  WebHook,
  addWebhook,
}