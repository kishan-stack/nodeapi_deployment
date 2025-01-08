import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
const kindeSetupCheck = asyncHandler(async (req, res) => {
    console.log(req.user);
    
});
const getAccessToken = async () => {
    try {
        const searchParams = {
            grant_type: "client_credentials",
            client_id: "f5eab96591ca4c699eae155c69c2afc2",
            client_secret: "ZH1bW1CWzk7ct8VnqglneuftDwMxzIAV65kNrrmkKbrgaAS99Z",
            audience: "https://mandli.kinde.com/api"
        };

        const res = await fetch("https://mandli.kinde.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams(searchParams)
        });
        const token = await res.json();
        // console.log({ token });
        return token;
    } catch (err) {
        console.error(err);
    }
};

export { kindeSetupCheck }