import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Failed to generate access and refresh token", error.message)
    }
}

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
    if (req.files && Array.isArray(req.files.coverImage) && req.coverImage.length > 0) {
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
    if (!email || !username) {
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


export {
    registerUser,
    loginUser,
    logoutUser
}