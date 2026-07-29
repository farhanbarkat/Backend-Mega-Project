import mongoose from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    

    // HINT 1: Validate Channel ID
    // - Check karo ki 'channelId' valid Mongo ObjectId format mein hai ya nahi (`mongoose.Types.ObjectId.isValid`).
    // - Agar invalid hai, toh 400 ApiError throw karo.

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "invalid channelId")
    }

    // HINT 2: Prevent Self-Subscription
    // - Check karo ki `req.user?._id.toString() === channelId.toString()` toh nahi hai.
    // - User khud ke channel ko subscribe nahi kar sakta.
   if (req.user?._id.toString() === channelId.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel")
   }
    // HINT 3: Check Existing Subscription
    // - Subscription model par `findOne` chalao:
    //   `const existingSub = await Subscription.findOne({ subscriber: req.user?._id, channel: channelId })`
    const existingSub = await Subscription.findOne( {
        subscriber: req.user?._id,
        channel: channelId,
        
    })

    // HINT 4: Toggle Action (Delete if exists, Create if not)
    // - IF `existingSub` exists:
    //     -> Use `Subscription.findByIdAndDelete(existingSub._id)` to unsubscribe.
    //     -> Send 200 response: "Unsubscribed successfully"
   if (existingSub) {
    await Subscription.findByIdAndDelete(existingSub._id)
    return res.status(200).json(new ApiResponse(200, {}, "Unsubscribed successfully"))
}

    // - ELSE:
    //     -> Use `Subscription.create({ subscriber: req.user?._id, channel: channelId })` to subscribe.
    //     -> Send 200 response: "Subscribed successfully"

    else {
        await Subscription.create( {
            subscriber: req.user?._id,
            channel: channelId
        } )
        return res.status(200).json(new ApiResponse(200, {}, "Subscribed successfully"))
        
    }
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    console.log("Req Params:", req.params);
console.log("ChannelId Value:", req.params.channelId);

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "invalid ChannelId")
    }

    const subscribers = await Subscription.aggregate([
        { 
            $match: {channel: new mongoose.Types.ObjectId(channelId)}
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberDetails"
            }
        },
        {
            $unwind: "$subscriberDetails"

        },
        {

            
           $project: {
                _id: "$subscriberDetails._id",
                username: "$subscriberDetails.username",
                fullName: "$subscriberDetails.fullName", 
                avatar: "$subscriberDetails.avatar"

         }   
        }

    ])
        return res.status(200).json(
        new ApiResponse(200, subscribers, "Subscribers fetched successfully"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    // HINT 1: Validate Subscriber ID
    // - Check karo ki 'subscriberId' valid Mongo ObjectId format mein hai ya nahi (`mongoose.Types.ObjectId.isValid`).
    // - Agar invalid ho toh 400 ApiError throw karo.
     if (!mongoose.Types.ObjectId.isValid(subscriberId)) {
        throw new ApiError(400, "invalid ChannelId")
    }
    
    // HINT 2: Aggregation Pipeline (Same pattern as previous controller)
    // - Subscription model par `aggregate([...])` (array brackets ke sath!) chalao:
    //
    //   1. `$match`: Is baar filter karo jahan `subscriber` field ki value `new mongoose.Types.ObjectId(subscriberId)` ke barabar ho.
    if(!mongoose.Types.ObjectId.isValid(subscriberId)) {
        throw new ApiError(400, "invalid subscriberId")
    }
    

    //
    //   2. `$lookup`: `users` collection se join karo, par is baar target field `channel` hoga!
    //      - `from`: "users"
    //      - `localField`: "channel" (kyunki humein channel ke details chahiye)
    //      - `foreignField`: "_id"
    //      - `as`: "subscribedChannel"
    //
    //   3. `$unwind`: Array ko flatten karke single object banao (`"$subscribedChannel"`).
    //
    //   4. `$project`: Sirf zaroori channel details pick karo:
    //      - `_id`: "$subscribedChannel._id"
    //      - `username`: "$subscribedChannel.username"
    //      - `fullName`: "$subscribedChannel.fullName"
    //      - `avatar`: "$subscribedChannel.avatar"
      
    const subscribedChannels = await Subscription.aggregate([
        {
            $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) }

        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "subscribedChannelDetails"
                
            }

        },
        {
            $unwind: "$subscribedChannelDetails"
        },
        {
            $project: {
                _id: "$subscribedChannelDetails._id",
                username: "$subscribedChannelDetails.username",
                fullName: "$subscribedChannelDetails.fullName",
                avatar: "$subscribedChannelDetails.avatar"
            }
        }


    ])

    // HINT 3: Send Success Response
    // - Status 200 ke saath array of channels return karo.
    // - Message: "Subscribed channels fetched successfully"

    return res.status(200).json(
        new ApiResponse(200, subscribedChannels, "Subscribed channels fetched successfully")
    )
})


export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels }