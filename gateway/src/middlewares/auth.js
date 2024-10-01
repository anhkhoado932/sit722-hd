//
// Middleware to verify JWT token for protected routes.
//
const axios = require("axios");

async function authenticateToken(req, res, next) {
    const token = req.cookies?.jwt;  // Get JWT from cookies

    if (!token) {
        return res.redirect('/login'); 
    }

    try {
        const response = await axios.post(`http://auth-service/verify`, { token });
        if (response.data.valid) {
            req.user = response.data.username; 
            next(); 
        } else {
            res.redirect('/login'); 
        }
    } catch (err) {
        console.error("Token verification failed", err);
        res.redirect('/login'); 
    }
}

module.exports = authenticateToken;