const { MongoClient } = require('mongodb');

let client;

const loadDB = async () => {
  if (client) {
    return client;
  }
  try {
    client = await MongoClient.connect('mongodb://richpaneladmin:richpaneladmin123@ds357955.mlab.com:57955/richpaneldb', { useNewUrlParser: true, useUnifiedTopology: true });
  } catch (err) {
    return err;
  }
  return client;
};

module.exports = loadDB;