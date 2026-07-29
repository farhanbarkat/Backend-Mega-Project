import mongoose from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    // HINT 1: Extract content from req.body
    // - User body me `content` bheje ga: `const { content } = req.body`

    const { content } = req.body;

    // HINT 2: Validation
    // - Check karo ki `content` present hai aur khali (empty string/spaces) toh nahi hai: `!content?.trim()`
    // - Agar missing hai toh 400 ApiError throw karo ("Content is required").

   if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
}

    // HINT 3: Create Tweet Document
    // - Tweet model par `Tweet.create` chalao:
    //   `content: content.trim()` aur `owner: req.user?._id` (JWT middleware se logged in user ki ID).

    const tweet = await Tweet.create({
        content: content.trim(),
        owner: req.user?._id
    })

    // HINT 4: Verify Creation & Send Response
    // - Check karo ki tweet document create hua ya nahi.
    // - Status 201 (Created) ke saath created tweet object return karo.

    if (!tweet) {
        new ApiError(500, "Failed to create tweet");
    }

    return res.status(201).json(new ApiResponse(201, tweet, "Tweet created successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params

    // HINT 1: Validate Params
    // - Check karo ki `userId` valid Mongo ObjectId format mein hai ya nahi (`isValidObjectId(userId)`).
    // - Agar invalid ho toh 400 ApiError throw karo.

    if (!mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid userId");
    }

    // HINT 2: Fetch Tweets from Database
    // - Tweet model par `find` chalao: `const tweets = await Tweet.find({ owner: userId })`
    // - (Optional/Best Practice): Aggregation pipeline ya `.populate("owner", "username fullName avatar")` use kar sakte ho.

    const tweets = await Tweet.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }

        },
        {
            $unwind: "$ownerDetails"
        },
        {
            $project: {
                owner: "$ownerDetails._id",
                username: "$ownerDetails.username",
                fullName: "$ownerDetails.fullName",
                avatar: "$ownerDetails.avatar",
                content: 1,
                createdAt: 1,
                updatedAt: 1

            }
        }
    ])

    // HINT 3: Send Response
    // - Status 200 ke saath tweets ki list (`tweets` array) return karo.
    return res.status(200).json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
})

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    // 1. Validation 
    if (!mongoose.isValidObjectId(tweetId) || !content?.trim()) {
        throw new ApiError(400, "Invalid tweet ID or content is required");
    }

    // 2. Single DB Operation (Check + Ownership + Update in 1 Call)
    const updatedTweet = await Tweet.findOneAndUpdate(
        {
            _id: tweetId,
            owner: req.user?._id // Security check: Sirf owner hi update kar sake
        },
        {
            $set: {
                content: content.trim()
            }
        },
        { new: true }
    );

    // 3. Existence & Ownership Check
    if (!updatedTweet) {
        throw new ApiError(404, "Tweet not found or you are unauthorized to update it");
    }

    // 4. Send Standardized Success Response
    return res
        .status(200)
        .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    // 1. Validate Param
    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID")
    }

    // 2. Aggregation Pipeline for Existence & Ownership Check
    const tweet = await Tweet.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(tweetId)
            }
        },
        {
            $project: {
                owner: 1,
                isOwner: {
                    $eq: ["$owner", new mongoose.Types.ObjectId(req.user?._id)]
                }
            }
        }
    ])

    // Step A: Existence Check (Array empty matlab tweet nahi mila)
    if (!tweet.length) {
        throw new ApiError(404, "Tweet not found")
    }

    // Step B: Ownership Check (isOwner flag boolean hai)
    if (!tweet[0].isOwner) {
        throw new ApiError(403, "Unauthorized to delete this tweet")
    }

    // 3. Delete Document after validation
    await Tweet.findByIdAndDelete(tweetId)

    // 4. Send Success Response
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Tweet deleted successfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}