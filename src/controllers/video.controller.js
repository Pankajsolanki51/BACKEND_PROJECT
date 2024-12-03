import mongoose from "mongoose";
import {video} from "../models/video.model.js";
import {user} from "../models/user.model.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {ApiError} from "../utils/ApiError.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {asyncHandler} from "../utils/asyncHandler.js";

const getAllVideos = asyncHandler(async (req,res)=>{
    const {page = 1, limit = 10, query,sortBy,sortType,userId} = req.query;
    // get all videos based on query , sorting and pagination
    const videos = await videos.find(query).sort({[sortBy]:sortType}).skip((page-1)*limit).limit(limit);

    res.status(200).json(new ApiResponse(200,videos))

})

const publishVideo = asyncHandler(async (req,res)=>{
    const {title, description} = req.body;
    // get videos , upload video to cloudinary, create video object and save it to db
    const videoFile = await uploadOnCloudinary(req.file.path);
    if(!videoFile) throw new ApiError(400,"Failed to upload video to cloudinary");
    const video = new videos({
        title,
        description,
        videoFile
    })

    await video.save();
    res.status(200).json(new ApiResponse(200,video))
})

export {
    getAllVideos,
    publishVideo
}