import mongoose from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    // HINT 1: Validate videoId
    // - Check karo ki `videoId` valid Mongo ObjectId format mein hai ya nahi (`mongoose.isValidObjectId`).
    // - Invalid hone par 400 ApiError throw karo.
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // HINT 2: Check Existing Like
    // - Like model par `findOne` chalao check karne ke liye ki kya is user ne pehle se yeh video like ki hai:
    //   Condition: `{ video: videoId, likedBy: req.user?._id }`
    const alreadyLiked = await Like.findOne({ 
        video: videoId, likedBy: req.user?._id 
    });

    // HINT 3: Toggle Logic (Like ya Unlike)
    // - IF (alreadyLiked exist karta hai):
    //   -> Use `deleteOne({ _id: alreadyLiked._id })` se remove (Unlike) kar do.
    //   -> Ek variable mein store kar lo ki `isLiked = false`.
    if (alreadyLiked) {
        await Like.findByIdAndDelete(alreadyLiked._id);
        var isLiked = false;

        return res
        .status(200).json(new ApiResponse(200, { isLiked: false }, "Video unliked successfully"));
    }

    // - ELSE (pehly se like nahi hai):
    //   -> `Like.create({ video: videoId, likedBy: req.user?._id })` karke naya Document banao.
    //   -> Variable set karo `isLiked = true`.
    else {

    await Like.create({
        video: videoId,
        likedBy: req.user?._id
    });
    
    return res
        .status(200).json(new ApiResponse(200, { isLiked : true }, "Video liked successfully"));

}


    // HINT 4: Send Standard Response
    // - Status 200 ke sath response bhej do jisme `isLiked` status (boolean) frontend ko mil jaye.
    // - Format: `new ApiResponse(200, { isLiked }, isLiked ? "Video liked successfully" : "Video unliked successfully")`
    return res
        .status(200)
        .json(new ApiResponse(200, { isLiked }, isLiked ? "Video liked successfully" : "Video unliked successfully"));
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    // HINT 1: Validate commentId
    // - Check karo ki `commentId` valid Mongo ObjectId hai ya nahi (`mongoose.isValidObjectId`).
    // - Invalid ho toh 400 ApiError throw karo.

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    // HINT 2: Atomic Find & Delete (Unlike Check)
    // - `Like.findOneAndDelete` chalao condition ke saath:
    //   `{ comment: commentId, likedBy: req.user?._id }`
    // - Is se ek hi DB call mein check bhi ho jayega aur agar exist karta hua toh delete (unlike) bhi ho jayega.
    const deletedLike = await Like.findOneAndDelete({ 
        comment: commentId, likedBy: req.user?._id
    });

    // HINT 3: Toggle Logic (If Deleted -> Unlike Success)
    // - Agar `deletedLike` truthy hai (null nahi hai):
    //   -> Matlab comment pehle se liked tha aur ab delete ho chuka hai.
    //   -> Status 200 ke saath return karo: `{ isLiked: false }` aur message "Comment unliked successfully".
    if (deletedLike) {
        return res
        .status(200).json(new ApiResponse(200, { isLiked: false }, "Comment unliked successfully"));
    }

    // HINT 4: Create Like (If Not Deleted -> Like Success)
    // - Agar `deletedLike` null aaya, matlab pehle se liked nahi tha:
    //   -> `Like.create({ comment: commentId, likedBy: req.user?._id })` karke naya like document banao.
    //   -> Status 201 ke saath return karo: `{ isLiked: true }` aur message "Comment liked successfully".

    await Like.create({
        comment: commentId,
        likedBy: req.user?._id
    });
    return res
        .status(201).json(new ApiResponse(201, { isLiked: true }, "Comment liked successfully"));
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    // 1. Validate tweetId
    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    // 2. Atomic Find & Delete (Notice findOneAndDelete instead of findByIdAndDelete)
    const deletedLike = await Like.findOneAndDelete({
        tweet: tweetId,
        likedBy: req.user?._id
    });

    // 3. If deleted -> Tweet was previously liked, now UNLIKED
    if (deletedLike) {
        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully"));
    }

    // 4. If not deleted (null) -> Tweet was NOT liked, now LIKED
    await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id
    });

    return res
        .status(201)
        .json(new ApiResponse(201, { isLiked: true }, "Tweet liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
    // HINT 1: Get Logged-in User ID
    // - Authenticated user ki ID `req.user?._id` se extract karo.
    // - Verify karo ki user logged in hai ya nahi.

    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized: User not Logged in")
    }

    // HINT 2: Build Aggregation Pipeline on `Like` Model
    // - Stage 1 ($match):
    //   -> Unhi docs ko filter karo jahan `likedBy` logged-in user ki ID ho (`new mongoose.Types.ObjectId(req.user._id)`).
    //   -> Check karo ki `video` field exist karti hai (`$exists: true, $ne: null`), taaki comment/tweet likes ignore ho jayein.
const LikedVideos = await Like.aggregate([
    // STAGE 1: Filter logged-in user's video likes
    {
        $match: {
            likedBy: new mongoose.Types.ObjectId(req.user._id),
            video: { $exists: true, $ne: null }
        }
    },

    // STAGE 2: 1st Lookup (Like -> Video)
    {
        $lookup: {
            from: "videos",          // 'videos' collection se data lao
            localField: "video",     // Like model ki 'video' ID match karo
            foreignField: "_id",     // Video model ki '_id' se
            as: "likedVideo"
        }
    },

    // STAGE 3: Unwind 1st Lookup Array
    {
        $unwind: "$likedVideo"       // Array [{...}] ko single object {...} banao
    },

    // STAGE 4: 2nd Lookup (Nested Lookup: Video -> User/Owner)
    {
        $lookup: {
            from: "users",                 // 'users' collection se data lao
            localField: "likedVideo.owner",// Unwound 'likedVideo' ke andar maujood 'owner' ID match karo
            foreignField: "_id",           // User model ki '_id' se
            as: "ownerDetails"
        }
    },

    // STAGE 5: Unwind 2nd Lookup Array
    {
        $unwind: {
            path: "$ownerDetails",
            preserveNullAndEmptyArrays: true // Owner account deleted ho tab bhi code crashe na ho
        }
    },

    // STAGE 6: Project Clean Shape
    {
        $project: {
            _id: "$likedVideo._id",
            title: "$likedVideo.title",
            description: "$likedVideo.description",
            videoFile: "$likedVideo.videoFile",
            thumbnail: "$likedVideo.thumbnail",
            duration: "$likedVideo.duration",
            views: "$likedVideo.views",
            createdAt: "$likedVideo.createdAt",
            owner: {
                _id: "$ownerDetails._id",
                username: "$ownerDetails.username",
                fullName: "$ownerDetails.fullName",
                avatar: "$ownerDetails.avatar"
            }
        }
    }
]);

    // HINT 7: Send Response
    // - Status 200 ke sath fetch ki gayi liked videos ka array return karo.
    // - Format: `new ApiResponse(200, likedVideos, "Liked videos fetched successfully")`
    return res
        .status(200)
        .json(new ApiResponse(200, LikedVideos, "Liked videos fetched successfully"))
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}