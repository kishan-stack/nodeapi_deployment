import getAccessToken from "./getAccessToken.js";
const updatePropertiesOfUser = async (method, userId, propertyKey, value) => {
    try {
        const accessToken = await getAccessToken(); // Your existing getAccessToken function
    
        const response = await fetch(`${process.env.KINDE_AUDIENCE_URL}/v1/users/${userId}/properties/${propertyKey}?value=${value}`, {
            method,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken.access_token}`
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error in update properties of User!",error)
    }
}
export { updatePropertiesOfUser }