const appSchema = require('./appSchema');
const {gql} = require('apollo-server-express');

const linkSchema = gql`
  type Query {
    _: Boolean
  }

  type Mutation {
    _: Boolean
  }

  type Subscription {
    _: Boolean
  }
`;

module.exports = [
  linkSchema,
  appSchema,
];