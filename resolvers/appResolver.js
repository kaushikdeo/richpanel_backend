const { ObjectId } = require('mongodb');
const constants = require('../constants');
const NEW_MENTION = 'NEW_MENTION';
const { Autohook } = require('twitter-autohook');

module.exports = {
  Query: {
    greetings: async (parent, {}, {db}) => {
      return "Hello World";
    },
    fetchCurrentMentions: async (parent, {}, {T, db}) => {
      const currentMentions = await T.get("/statuses/mentions_timeline", {});
      const allMentions = currentMentions.data.map(mention => {
        const tweetImages = mention.entities && mention.entities.media ? mention.entities.media : [];
        const tweetMedia = tweetImages && tweetImages.length > 0 ? mention.entities.media.map(m => m.media_url) : [];
        const newMention = {
          _id: ObjectId(),
          mentionID: mention.id_str,
          mentionText: mention.text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, ''),
          timeStamp: new Date(new Date(mention.created_at)),
          tweetImages: tweetMedia,
          in_reply_to_status_id_str: mention.in_reply_to_status_id_str,
          tasks: [],
          replies: [],
          userData: {
            twitterUserId: mention.user.id_str,
            mentionFromScreenName: mention.user.screen_name,
            description: mention.user.description,
            profileImage: mention.user.profile_image_url_https,
            location: mention.user.location,
          }
        }
        // console.log('ISO STRING', new Date(new Date(mention.created_at)));
        return newMention;
      })
      allMentions.map(async (me) => {
        // if the mention has a in_reply_to_status_id_str value then this is a reply
        if (!me.in_reply_to_status_id_str) {
          //this is a fresh mention
            const isPresent = await db.collection('mentions').findOne({mentionID: me.mentionID});
            if (!isPresent) {
              me.orignalMention = null;
              await db.collection('mentions').insertOne(me);
            }
        }
        // const isPresent = await db.collection('mentions').findOne({mentionID: me.mentionID});
        // if (!isPresent) {
        //   await db.collection('mentions').insertOne(me);
        // }
      })
      const dbMentions = await db.collection('mentions').find({orignalMention: null}).sort({timeStamp: 1}).toArray();
      return dbMentions;
    },
  },
  Mutation: {
    addNewMentionTask: async (parent, {mentionId, taskText}, {db}) => {
      const newTask = {
        _id: ObjectId(),
        taskText,
        mentionId: mentionId,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        endDate: new Date().toISOString(),
      }
      // Add new task
      const newAddedTask = await db.collection('tasks').insertOne(newTask);
      // Add taskId to the mention
      await db.collection('mentions').findOneAndUpdate({mentionID: mentionId}, {$addToSet: {tasks: newAddedTask.ops[0]._id}})
      return newTask
    },
    replyToMention: async (parent, {InReplyToStatus, replyText, userHandle}, {T, db}) => {
      const params = {
        status: `@${userHandle} ${replyText}`,
        in_reply_to_status_id: InReplyToStatus,
      }
      const finalReply = await await T.post('statuses/update', params);
      const tweetImages = finalReply.data.entities && finalReply.data.entities.media ? finalReply.data.entities.media : [];
      const tweetMedia = tweetImages && tweetImages.length > 0 ? finalReply.data.entities.media.map(m => m.media_url) : [];
      const newReply = {
        _id: ObjectId(),
        mentionID: finalReply.data.id_str,
        mentionText: finalReply.data.text,
        tweetImages: tweetMedia,
        timeStamp: finalReply.data.created_at,
        in_reply_to_status_id_str: finalReply.data.in_reply_to_status_id_str,
        tasks: [],
        userData: {
          twitterUserId: finalReply.data.user.id_str,
          mentionFromScreenName: finalReply.data.user.screen_name,
          description: finalReply.data.user.description,
          profileImage: finalReply.data.user.profile_image_url_https,
          location: finalReply.data.user.location,
        },
        replies: []
      };
      // await db.collection('mentions').findOneAndUpdate({mentionID: newReply.in_reply_to_status_id_str}, { $addToSet: { replies: newReply } })
      return newReply;
    },
    setupWebhook: async (parent, {}, {token, tokenSecret, T, db, pubsub}) => {
      const webhook = new Autohook({
        token: token,
        token_secret: tokenSecret,
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        env: 'dev',
      });
      const startHook = async () => {
        try {
          // Removes existing webhooks
          await webhook.removeWebhooks();
          
          if(webhook) {}
          // Starts a server and adds a new webhook
          await webhook.start();
        
          // Subscribes to your own user's activity
          await webhook.subscribe({oauth_token: token, oauth_token_secret: tokenSecret});
          webhook.on('event', async(event) => {
            // push to database
            const allMentions = event.tweet_create_events.map(mention => {
              const tweetImages = mention.entities && mention.entities.media ? mention.entities.media : [];
              const tweetMedia = tweetImages && tweetImages.length > 0 ? mention.entities.media.map(m => m.media_url) : [];
              const newMention = {
                _id: ObjectId(),
                mentionID: mention.id_str,
                mentionText: mention.text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, ''),
                timeStamp: new Date(new Date(mention.created_at)),
                in_reply_to_status_id_str: mention.in_reply_to_status_id_str,
                tweetImages: tweetMedia,
                tasks: [],
                replies: [],
                userData: {
                  twitterUserId: mention.user.id_str,
                  mentionFromScreenName: mention.user.screen_name,
                  description: mention.user.description,
                  profileImage: mention.user.profile_image_url_https,
                  location: mention.user.location,
                }
              };
              return newMention;
            });
            const fetchedMentions = await Promise.all(
              allMentions.map(async (me) => {
                if (me.in_reply_to_status_id_str) {
                  // this is a reply
                  // fetch parent mention from DB
                  const orignalMention = await db.collection('mentions').findOne({mentionID: me.in_reply_to_status_id_str});
                  if (orignalMention.orignalMention){
                    me.orignalMention = orignalMention.orignalMention;
                  } else {
                    me.orignalMention = me.in_reply_to_status_id_str
                  }
                  const newAdded = await db.collection('mentions').insertOne(me);
                  const parentMention = await db.collection('mentions').findOneAndUpdate({mentionID: me.orignalMention}, {$addToSet: {replies: newAdded.ops[0]._id}}, {returnOriginal: false})
                  subMention = parentMention.value;
                } else {
                  // this is a new mention
                  me.orignalMention = null;
                  const newAdded = await db.collection('mentions').insertOne(me);
                  subMention = newAdded.ops[0];
                }
                return subMention;
              })
            )
            pubsub.publish(NEW_MENTION, {newMention: fetchedMentions});
          })
        } catch (e) {
          // Display the error and quit
          console.error(e);
          process.exit(1);
        }
      };
      startHook();
     return {
       success: true,
       message: "Attatched webhook"
     }
    },
  },
  Subscription: {
    newMention: {
      subscribe: (parent, {}, {pubsub}) => pubsub.asyncIterator([NEW_MENTION])
    },
  },
  Mention: {
    tasks: async (parent, {}, {db}) => {
      if (parent.tasks && parent.tasks.length > 0){
        const allTasks = await Promise.all(parent.tasks.map(async (task) => {
          const fetchedTask = await db.collection('tasks').findOne({_id: ObjectId(task)});
          return fetchedTask;
        }))
        return allTasks;
      }
      return [];
    },
    replies: async (parent, {}, {db}) => {
      if (parent.replies && parent.replies.length > 0) {
        const allReplies = await Promise.all(parent.replies.map(async (r) => {
          const replyData = await db.collection('mentions').findOne({_id: ObjectId(r)});
          return replyData;
        }))
        return allReplies;
      }
    }
  },
};