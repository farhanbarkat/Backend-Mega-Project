import mongoose from "mongoose"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // 1. Validate videoId
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Calculate Skip Value
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const skipValue = (pageNumber - 1) * limitNumber;

    console.log("pageNumber:", pageNumber, "limitNumber:", limitNumber, "skipValue:", skipValue);

    // 3. Run Aggregation Pipeline
    const comments = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $skip: skipValue // Page skip formula
        },
        {
            $limit: limitNumber // Total documents limit
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
           $unwind: {
             path: "$ownerDetails",
             preserveNullAndEmptyArrays: true
            }
        },

        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                owner: {
                    _id: "$ownerDetails._id",
                    username: "$ownerDetails.username",
                    fullName: "$ownerDetails.fullName",
                    avatar: "$ownerDetails.avatar"
                }
            }
        }
    ]);

    // 4. Send Response
    return res
        .status(200)
        .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    // HINT 1: Validate Params & Body
    // - Check karo ki `videoId` valid ObjectId hai ya nahi (`mongoose.isValidObjectId`).
    // - Check karo ki `content` present hai aur non-empty hai (`!content?.trim()`).
    // - Dono mein se koi fail ho toh 400 ApiError throw karo.

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Content is required");
    }

    // HINT 2: Create Comment Document
    // - Comment.create() chalao:
    //   `content: content.trim()`, `video: videoId`, aur `owner: req.user?._id` (JWT middleware se).

    const comment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: req.user?._id
    });

    // HINT 3: Verify Creation & Send Response
    // - Verify karo ki document create hua ya nahi.
    // - Status 201 (Created) ke saath created comment object return karo.

    if (!comment) {
        throw new ApiError(500, "Failed to create comment");
    }
    return res.status(201).json(new ApiResponse(201, comment, "Comment added successfully"));
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body
    console.log("commentId:", commentId, "content:", content);

    // HINT 1: Validate Params & Body
    // - Check karo ki `commentId` valid ObjectId hai (`mongoose.isValidObjectId`).
    // - Check karo ki naya `content` non-empty hai (`!content?.trim()`).
    // - Failed validation par 400 ApiError throw karo.

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Content is required");
    }

    // HINT 2: Find & Update with Ownership Check
    // - `Comment.findOneAndUpdate` chalao:
    //   Filter: `{ _id: commentId, owner: req.user?._id }` (Security Check: Sirf comment owner update kar sake).
    //   Update: `{ $set: { content: content.trim() } }`
    //   Options: `{ new: true }`

    const updatedComment = await Comment.findOneAndUpdate(
        { _id: commentId, owner: req.user?._id 

        }
        ,
        { $set: { content: content.trim() } 
    },
        { new: true }
    );

    // HINT 3: Check Existence & Send Response
    // - Agar updated comment null mile, toh 404 ApiError throw karo ("Comment not found or unauthorized").
    // - Status 200 ke saath updated comment object return karo.

    if (!updatedComment) {
        throw new ApiError(404, "Comment not found or unauthorized");
    }   
    return res.status(200).json(new ApiResponse(200, updatedComment, "Comment updated successfully"));
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    // HINT 1: Validate Param
    // - Check karo ki `commentId` valid ObjectId hai ya nahi (`mongoose.isValidObjectId`).

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    // HINT 2: Find & Delete with Ownership Check
    // - `Comment.findOneAndDelete` chalao:
    //   Filter: `{ _id: commentId, owner: req.user?._id }`
    if (!await Comment.findOneAndDelete({ _id: commentId, owner: req.user?._id })) {
        throw new ApiError(404, "Comment not found or unauthorized");
    }


    // HINT 3: Check Existence & Send Response
    // - Agar response null aaye, toh 404 ApiError throw karo ("Comment not found or unauthorized").
    // - Status 200 ke saath empty object `{}` aur success message return karo.

    return res.status(200).json(new ApiResponse(200, {}, "Comment deleted successfully"));
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}