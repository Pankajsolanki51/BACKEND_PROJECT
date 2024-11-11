import multer from "multer";
import express from "express";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname) // later can add unique name functionla using suffix 
    }
})

export const upload = multer({ storage, })