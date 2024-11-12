import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express()

// this is for cors
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true,

}))

//this is for json kind of data
app.use(express.json({limit:"16kb"}))

// this is for url encoded data
app.use(express.urlencoded({extended:true,limit:"16kb"}))

// this is for images
app.use(express.static("public"))

// this is for cookies
app.use(cookieParser())


//routes import

import userRouter from "./routes/user.routes.js"

//routes declaration
app.use("/api/v1/users",userRouter)


export {app}