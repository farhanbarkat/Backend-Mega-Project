import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended:true, limit: "16kb"}))
app.use(express.static("public"))

app.use(cookieParser())

//router import
import userRouter from './routes/user.routes.js'
import playlistRouter from "./routes/playlist.routes.js"
 
//router declartion
app.use("/api/v1/users",userRouter)
app.use("/api/v1/playlists", playlistRouter)


//http://localhost:8000/api/v1/users/register
//http://localhost:8000/api/v1/playlists/create

export {app} 