import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js" 

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
    if(req.files && Array.isArray(req.files.coverImage) && req.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocaPath){
        throw new ApiError(400,"Avatar File is required")
    }
    // upload them to cloudinary, avatar successfully uploaded by multer
    const avatar = await uploadOnCloudinary(avatarLocaPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar File is required")
    }
    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "", 
        email,
        password,
        username:username.toLowerCase()
    })
    // remove password and refresh token filed from resposne
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //check fr user creation
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    
    //if created return response other wise error
    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registered successfully")
    )


})

export { registerUser }