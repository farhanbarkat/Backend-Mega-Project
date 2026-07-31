import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const healthcheck = asyncHandler(async (req, res) => {
    // 1. Status code 200 (OK) set karein aur JSON response return karein
    return res
        .status(200)
        .json({
            status: "success",
            message: "Server is healthy and running smoothly!",
            data: {
                uptime: process.uptime(), // Optional: Batata hai server kitni der se chal raha hai
                timestamp: new Date()      // Optional: Current request ka time
            }
        });
});

export {
    healthcheck
    }
    