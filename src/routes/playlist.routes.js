import { Router } from "express"
import { createPlaylist, getUserPlaylists, getPlaylistById, addVideoToPlaylist,
    removeVideoFromPlaylist , deletePlaylist, updatePlaylist
 } from "../controllers/playlist.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()


router.use(verifyJWT) // Apply JWT verification middleware to all routes in this router

router.route("/").post(createPlaylist) // create A new Playist

router
    .route("/:playlistId")
    .get(getPlaylistById)
    .patch(updatePlaylist)
    .delete(deletePlaylist);

router.route("/user/:userId").get(getUserPlaylists) // get all playlists of a user
router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);

export default router