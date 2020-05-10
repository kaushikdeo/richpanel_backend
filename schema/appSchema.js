const { gql } = require('apollo-server-express');

module.exports = gql`
  extend type Query {
    greetings: String!,
    fetchCurrentMentions: [Mention]
    setupWebhook: Response
  }

  extend type Mutation {
    addNewMentionTask(mentionId: String! taskText: String!): Task!
    replyToMention(InReplyToStatus: String, replyText: String, userHandle: String): Mention
  }

  extend type Subscription {
    newMention: [Mention]
  }

  # Types
  type Mention {
    _id: ID
    mentionID: String!
    mentionText: String!
    tweetImages: [String]
    timeStamp: String!
    in_reply_to_status_id_str: String
    tasks: [Task]
    userData: UserData
    replies: [Mention]
  }

  type Response {
    success: Boolean
    message: String
  }

  type UserData {
    twitterUserId: String!,
    mentionFromScreenName: String,
    description: String,
    profileImage: String,
    location: String,
  }

  type Reply {
    replyId: String
    replyText: String
    replyingUser: UserData
  }

  type Task {
    _id: ID
    taskText: String!
    createdAt: String!
    endDate: String!
    mentionId: String!
  }
`;