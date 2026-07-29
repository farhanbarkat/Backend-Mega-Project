import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    toggleSubscription,
} from "../controllers/subscription.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

// ✅ Correct: Channel ID se uske SUBSCRIBERS milenge (/c/:channelId)
router
    .route("/c/:channelId")
    .get(getUserChannelSubscribers)
    .post(toggleSubscription);

// ✅ Correct: Subscriber ID se uske SUBSCRIBED CHANNELS milenge (/u/:subscriberId)
router
    .route("/u/:subscriberId")
    .get(getSubscribedChannels);

export default router;