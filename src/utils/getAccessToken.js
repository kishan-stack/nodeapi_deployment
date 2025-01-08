const getAccessToken = async () => {
    try {
        const searchParams = {
            grant_type: "client_credentials",
            client_id: process.env.KINDE_CLIENT_ID,
            client_secret: process.env.KINDE_SECRET,
            audience: process.env.KINDE_AUDIENCE_URL,
        };

        const res = await fetch(`${process.env.KINDE_ISSUER_BASE_URL}/oauth2/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams(searchParams)
        });
        const token = await res.json();
        // console.log({ token });
        return token;
    } catch (error) {
        console.error("Error in getAccessToken",error);
        return null;
    }
};

export default getAccessToken;