import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { response } from "express";
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        if (!user) {
            console.error("user not found with ID:", userId);

            throw new ApiError(404, "user not found")
        }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Failed to generate access and refresh token", error.message)
    }
};

const registerUser = asyncHandler(async (req, res) => {
    //get users details from frontend 
    const { fullName, email, username, password } = req.body


    // validate user details
    if (
        [fullName, email, username, password].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }
    //check if user already exists
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User With Email and username already exist")
    }



    // check for images, chcek for avatar
    const avatarLocaPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocaPath) {
        throw new ApiError(400, "Avatar File is required")
    }
    // upload them to cloudinary, avatar successfully uploaded by multer
    const avatar = await uploadOnCloudinary(avatarLocaPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "Avatar File is required")
    }
    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    // remove password and refresh token filed from resposne
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //check fr user creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }


    //if created return response other wise error
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )


})

const loginUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { email, username, password } = req.body
    // get data username or email and password
    if (!(email || username)) {
        throw new ApiError(400, "username or email fields are required")
    }
    // find the user existed or not
    const user = await User.findOne({
        $or: [{ email }, { username }]
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }
    // check for password
    const isPasswordVaid = await user.isPasswordCorrect(password)
    if (!isPasswordVaid) {
        throw new ApiError(401, "Invalid password")
    }
    // check for refresh  token check for access token
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    // send cookies
    const loggedInUser = await User.findById(user._id).
        select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200, {
                user: loggedInUser,
                accessToken
            }, "User logged in successfully")
        )
})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }

    )
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "User logged out successfully"))

})

// genrating new refersh  token afte session expiration 
const refreshAccessToken = asyncHandler(async (req, res) => {
    const IncomingrefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!IncomingrefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(IncomingrefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "invalid referesh token request")
        }

        // match both te refresh token
        if (user.refreshToken !== IncomingrefreshToken) {
            throw new ApiError(401, "invalid referesh token is expired or used")
        }

        //if validated then generate new token
        const options = {
            httpOnly: true,
            secure: true,
        }

        const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(200, { accessToken }, "Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refersh token given")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body
    if (!(newPassword === confirmPassword)) {
        throw new ApiError(400, "New password and confirm password does not match")
    }
    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrectuser(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect")
    }
    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200)
        .json(new ApiResponse(200, {}, "password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200)
        .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "all fields are required")
    }


    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },
        { new: true }
    ).select("-password")

    return res.status(200)
        .json(new ApiResponse(200, user, "Account's details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Avatar upload failed")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    // delete the old image from cloudinary
    if (user.avatar) {
        await cloudinary.uploader.destroy(user.avatar)
    }



    return res
        .status(200)
        .json(new ApiResponse(200, avatar, "Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "CoverImage is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "coverImage upload failed")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    // delete the old image from cloudinary
    if (user.coverImage) {
        await cloudinary.uploader.destroy(user.coverImage)
    }
    return res
        .status(200)
        .json(new ApiResponse(200, coverImage, "CoverImage updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "username is required")
    }

    // writing pipelines
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channlesSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channlesSubscribedToCount: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel not found")
    }

    return res.status(200)
        .json(new ApiResponse(200, channel[0], "channel profile fetched successfully"))
})

const getWatchHistory = asyncHandler(async (req, res) => {
    // consvert th eis because its is a string
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "User",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully"))
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}