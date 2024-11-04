/*import mongoose from "mongoose";
import express from "express";
import { PORT, DB_NAME } from "./constants.js";

const app = express();

(async () => {
    try {
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)

        console.log("Connected to MongoDB")
        app.on("error", (error) => {
            console.log("Error", error);
            throw error
        })
        app.listen(process.env.PORT, () => {
            console.log(`Listening on port ${process.envPORT}`);
        })
    } catch (error) {
        console.log(error)
        throw error
    }
})*/



// SECOND IMPLEMENTATION

import { DB_NAME } from "./constants.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path: './.env' // Use './.env' if the file is in the same directory, or adjust the path as needed
});

connectDB();