const { ObjectId } = require('mongodb');
const constants = require('../constants');
const NEW_MENTION = 'NEW_MENTION';

module.exports = {
  Query: {
    greetings: async (parent, {}, {db}) => {
      return "Hello World";
    },

    setupWebhook: async (parent, {}, {token, tokenSecret, T, db, webhook, pubsub}) => {
      const startHook = async () => {
        try {
          
          // Removes existing webhooks
          await webhook.removeWebhooks();
          
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
                timeStamp: mention.created_at,
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
                const isPresent = await db.collection('mentions').findOne({mentionID: me.mentionID});
                const isReply = await db.collection('mentions').findOne({mentionID: me.in_reply_to_status_id_str});
                let subMention = null;
                if (isReply) {
                  const added = await db.collection('mentions').findOneAndUpdate({mentionID: me.in_reply_to_status_id_str}, { $addToSet: { replies: me } })
                  subMention = added.value;
                } else if (!isPresent) {
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

    fetchCurrentMentions: async (parent, {}, {T, db}) => {
      const currentMentions = await T.get("/statuses/mentions_timeline");
      const allMentions = currentMentions.data.map(mention => {
        const tweetImages = mention.entities && mention.entities.media ? mention.entities.media : [];
        const tweetMedia = tweetImages && tweetImages.length > 0 ? mention.entities.media.map(m => m.media_url) : [];
        const newMention = {
          _id: ObjectId(),
          mentionID: mention.id_str,
          mentionText: mention.text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, ''),
          timeStamp: mention.created_at,
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
        return newMention;
      })
      allMentions.map(async (me) => {
        const isPresent = await db.collection('mentions').findOne({mentionID: me.mentionID});
        if (!isPresent) {
          await db.collection('mentions').insertOne(me);
        }
      })
      const dbMentions = await db.collection('mentions').find({}).toArray();
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
      console.log('newly added task', newAddedTask);
      // Add taskId to the mention
      await db.collection('mentions').findOneAndUpdate({mentionID: mentionId}, {$addToSet: {tasks: newAddedTask.ops[0]._id}})
      return newTask
    },

    replyToMention: async (parent, {InReplyToStatus, replyText, userHandle}, {T}) => {
      console.log(' I AM IN');
      const params = {
        status: `@${userHandle} ${replyText}`,
        in_reply_to_status_id: InReplyToStatus,
      }
      T.post('statuses/update', params, async (err, data, response) => {
        // console.log('err', err);
        // console.log('data', data);
        console.log('responseresponseresponseresponseresponseresponseresponseresponseresponseresponse', response);
      })
      return {
        success: true,
        message: 'Replied'
      }
    }
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
    }
  },
};