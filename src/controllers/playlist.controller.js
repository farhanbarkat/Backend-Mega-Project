import mongoose from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body    

    // 1. Validation check Karo: Ensure karo ke 'name' (aur agar 'description' required hai) empty ya spaces na hon.
    //    Agar empty hai toh throw new ApiError(400, "Name is required")

    if (
        [name, description].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Name and description are required")
    }
    // 2. User Authentication Check: Check karo ke Logged-in user ki ID available hai (req.user?._id).
    //    Agar user login nahi hai toh throw new ApiError(401, "Unauthorized access")
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized access")
    }

    // 3. Create Playlist in DB: Playlist.create({...}) use karke new playlist document banao.
    //    Isme 'name', 'description', aur 'owner: req.user._id' pass karo.
    const createdPlaylist = await Playlist.create({
        name,
        description,
        owner: req.user._id
    })

    // 4. Verify Creation: Check karo ke DB me playlist successfully create hui ya nahi.
    //    Agar playlist nahi bani toh throw new ApiError(500, "Failed to create playlist")
    if (!createdPlaylist) {
        throw new ApiError(500, "Failed to create playlist")
    }

    // 5. Send Response: Client ko ApiResponse ke sath success response bhejo (Status code 201).
    //    res.status(201).json(new ApiResponse(201, createdPlaylist, "Playlist created successfully"))
    res.status(201).
    json(new ApiResponse(201, createdPlaylist, "Playlist created successfully")) 
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params

    // 1. Validation Check (Empty + Mongo ObjectId format)
    if (!userId?.trim() || !mongoose.isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid or missing User ID")
    }

    // 2. Fetch User Playlists via Aggregation Pipeline
    const userPlaylists = await Playlist.aggregate([
        {
            $match: { 
                owner: new mongoose.Types.ObjectId(userId) 
            }
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
                name: 1,
                description: 1,
                videos: 1,
                createdAt: 1,
                "ownerDetails.username": 1,
                "ownerDetails.avatar": 1 
            }
        }
    ])

    // 3. Send Success Response (Empty array [] automatically goes if no playlists)
    return res
        .status(200)
        .json(
            new ApiResponse(
                200, 
                userPlaylists, 
                "User playlists fetched successfully"
            )
        )
})


const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    // 1. Validate Params (playlistId Check):
    //    - Check karo ki 'playlistId' missing toh nahi hai.
    //    - Mongoose `isValidObjectId` se verify karo ki playlistId valid Mongo ObjectId format hai.
    //    - Agar invalid hai toh: throw new ApiError(400, "Invalid or missing Playlist ID")
     
    if (!playlistId?.trim() || !mongoose.isValidObjectId(playlistId)){
        throw new ApiError(400, "invalid or Missing PlayList ID")
    }

    // 2. Fetch Playlist using Aggregation Pipeline:
    //    - Step 2.1: $match stage me playlistId ko `new mongoose.Types.ObjectId(playlistId)` se match karo.
    //    - Step 2.2: $lookup stage se owner ki details 'users' collection se join karo (as: "owner").
    //    - Step 2.3: $unwind stage se "owner" array ko single object banao.
    //    - Step 2.4: (Optional/Recommended) $lookup stage se "videos" collection se video details fetch karo.
    //    - Step 2.5: $project stage se sirf required fields filter karke bhejo (e.g. name, description, videos, owner).

    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },{
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },{
            $unwind: "$ownerDetails"
        },{
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videoDetails"
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                videos: "$videoDetails",
                ownerDetails: {
                    username: 1,
                    avatar: 1
                }
            }
        }
    ])

    // 3. Verify Result:
    //    - Check karo ki playlist DB me mili ya nahi.
    //    - Note: Aggregation me agar match nahi milta toh empty array `[]` aata hai.
    //    - Agar `!playlist.length` (ya `!playlist[0]`) hai toh: throw new ApiError(404, "Playlist not found")

    if (!playlist.length) {
        throw new ApiError(404, "Playlist not found")
    }

    // 4. Send Response:
    //    - Client ko single playlist object `playlist[0]` ke sath 200 success response bhejo.
    //    - res.status(200).json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"))
    res.status
    (200)
    .json(
        new ApiResponse
        (200, playlist, "playlist Fetched Successfully"))
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    // 1. Validate Params (both IDs):
    //    - Check karo ki 'playlistId' aur 'videoId' dono present hain.
    //    - Mongoose `isValidObjectId` se verify karo ki dono valid Mongo ObjectId format hain.
    //    - Agar koi missing/invalid hai: throw new ApiError(400, "Invalid Playlist or Video ID")

    if (
        !playlistId?.trim() || 
        !videoId?.trim() || 
        !mongoose.isValidObjectId(playlistId) || 
        !mongoose.isValidObjectId(videoId)
    ) {
        throw new ApiError(400, "Invalid Playlist or Video ID")
    }

    // 2. (Optional but Best Practice) Check Video Existence:
    //    - Check karo ki kya 'videoId' wali video sach me Database me exist karti hai.
    //    - Example: const video = await Video.findById(videoId)
    //    - Agar video nahi mili: throw new ApiError(404, "Video not found")

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "video not found")
    }

    // 3. Update Playlist DB Document:
    //    - Playlist model par `findByIdAndUpdate` chalao.
    //    - Mongo Operator `$addToSet: { videos: videoId }` use karo!
    //    - Note: `$push` ki jagah `$addToSet` ka fayda yeh hai ki yeh DUPLICATE video add nahi hone deta.
    //    - { new: true } flag pass karo taaki updated playlist return ho.

    const updatedPlayList = await Playlist.findByIdAndUpdate(
        playlistId,
        { $addToSet: 
            { videos: videoId }
        },
        { new: true }
    )

    // 4. Verify Playlist Exists:
    //    - Check karo ki `updatedPlaylist` mil gayi ya nahi.
    //    - Agar null aayi (yaani playlistId galat thi): throw new ApiError(404, "Playlist not found")


    if (!updatedPlayList) {
        throw new ApiError(404, "Playlist not found")
    }

    // 5. Send Success Response:
    //    - res.status(200).json(new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully"))
    res.status
    (200)
    .json(
        new ApiResponse
        (200, updatedPlayList, "Video added to playlist successfully")
    )

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params

    // 1. Validate Params (both IDs):
    //    - Check karo ki 'playlistId' aur 'videoId' dono missing toh nahi hain.
    //    - Mongoose `isValidObjectId` se verify karo ki dono valid Mongo ObjectId format hain.
    //    - Agar invalid hain toh: throw new ApiError(400, "Invalid Playlist or Video ID")

    if (
        !playlistId?.trim() ||
        !videoId?.trim() ||
        !mongoose.Types.ObjectId.isValid(playlistId) ||
        !mongoose.Types.ObjectId.isValid(videoId)
    )
    {
        throw new ApiError(400, "Invalid Playlist or Video Id")
    }
     
    

    // 2. Check Video Existence (Optional / Good Practice):
    //    - Verify karo ki 'videoId' DB me exist karti hai ya nahi.
    //    - const video = await Video.findById(videoId)
    //    - Agar nahi mili: throw new ApiError(404, "Video not found")

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // 3. Update Playlist Document using MongoDB $pull Operator:
    //    - Playlist model par `findByIdAndUpdate` chalao.
    //    - Mongo Operator `$pull: { videos: videoId }` use karo!
    //    - Note: `$pull` operator target array ('videos') me se matching 'videoId' ko dhoond kar REMOVE kar deta hai.
    //    - Pass option `{ new: true }` taaki clean updated playlist response me mile.

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        { $pull: { videos: videoId } 
        },
        { 
            new: true 
        }
    )

    // 4. Verify Playlist Existence:
    //    - Check karo ki `updatedPlaylist` mili ya nahi.
    //    - Agar null hai (invalid playlistId): throw new ApiError(404, "Playlist not found")
    if (!updatedPlaylist) {
        throw new ApiError(404, "Playlist not found")
    }

    // 5. Send Success Response:
    //    - Return 200 response with updated playlist object.
    //    - res.status(200).json(new ApiResponse(200, updatedPlaylist, "Video removed from playlist successfully"))

    res.status
    (200)
    .json
    (new ApiResponse(200, updatedPlaylist, "Video remove from playlist successfully"))
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    // HINT 1: Validate Params
    // - Check karo ki 'playlistId' valid Mongo ObjectId format mein hai ya nahi (`mongoose.Types.ObjectId.isValid`).
    // - Agar invalid ho toh 400 ApiError throw karo.

    if (!playlistId?.trim() || !mongoose.Types.ObjectId.isValid(playlistId)) 
    {
        throw new ApiError(400, "Invalid Playlist ID")
    }

    // HINT 2: Delete Playlist Document
    // - Playlist model par `findByIdAndDelete(playlistId)` method chalao.
    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)

    // HINT 3: Check Existence
    // - Check karo ki document mila aur delete hua ya nahi.
    // - Agar response null hai, toh 404 ApiError ("Playlist not found") throw karo.

    if (!deletedPlaylist) {
        throw new ApiError(404, "Playlist not found")
    }

    // HINT 4: Send Success Response
    // - Status 200 ke saath success ApiResponse return karo (empty object {} ke saath).
    res.status
    (200)
    .json
    (new ApiResponse(200, {}, "Playlist deleted successfully"))
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body

    // HINT 1: Validate Params and Body
    // - Verify karo ki 'playlistId' valid ObjectId hai ya nahi.
    // - Check karo ki 'name' ya 'description' me se kam se kam ek field provided ho.
    // - Agar dono missing hain, toh 400 ApiError throw karo.

    if (!playlistId?.trim() || !mongoose.Types.ObjectId.isValid(playlistId)) {
        throw new ApiError(400, "invalid Playlist ID")
    }

    if (!name?.trim() && !description?.trim()) {
        throw new ApiError(400, "At least one of 'name' or 'description' is required")
    }

    // HINT 2: Update Document using MongoDB $set Operator
    // - `Playlist.findByIdAndUpdate` chalao.
    // - Mongo `$set` operator se sirf non-empty fields update karo.
    // - Pass option `{ new: true }` taaki updated playlist object return ho.

    const updateFields = await Playlist.findByIdAndUpdate(playlistId, {
        $set: {
            name: name?.trim() || undefined,
            description: description?.trim() || undefined
        }
    }, { new: true })

    // HINT 3: Check Existence
    // - Agar updated playlist null mile, toh 404 ApiError throw karo.
    if (!updateFields) {
        throw new ApiError(404, "Playlist not found")
    }

    // HINT 4: Send Success Response
    // - Status 200 ke saath updated playlist object response mein bhej do.
    res.status
    (200)
    .json
    (new ApiResponse(200, updateFields, "Playlist updated successfully"))
})

export { createPlaylist, getUserPlaylists, getPlaylistById, addVideoToPlaylist , removeVideoFromPlaylist, deletePlaylist, updatePlaylist}