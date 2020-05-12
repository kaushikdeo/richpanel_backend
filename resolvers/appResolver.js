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
        const isPresent = await db.collection('mentions').findOne({mentionID: me.mentionID});
        if (!isPresent) {
          await db.collection('mentions').insertOne(me);
        }
      })
      const dbMentions = await db.collection('mentions').find({}).sort({timeStamp: 1}).toArray();
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
      console.log('JHBSJHBXHJSBSHJBXHJBXJHSBXJHSBXHJSJHBSJHBSJHSJHBXJHSBXJHSBJHBXJHSBJHSBXJHSBXJHSBJHBJHSBJHSBJHSBJHSBJHSBJHBJHBJHBJSH');
      const stream = await T.stream("/statuses/mentions_timeline", {});
      const webhook = new Autohook({
        token: token,
        token_secret: tokenSecret,
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        env: 'dev',
        port: 1337
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
            // console.log('EVENT', event);
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
                const isPresent = await db.collection('mentions').findOne({mentionID: me.mentionID});
                const isReply = await db.collection('mentions').findOne({mentionID: me.in_reply_to_status_id_str});
                let subMention = null;
                if (isReply) {
                  const added = await db.collection('mentions').findOneAndUpdate({mentionID: me.in_reply_to_status_id_str}, { $addToSet: { replies: me } })
                  subMention = added.value;
                } else 
                if (!isPresent) {
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
    }
  },
};