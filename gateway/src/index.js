const express = require("express");
const path = require("path");
const axios = require("axios");
const authenticateToken = require("./middlewares/auth");
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

const PORT = process.env.PORT;
const AUTH_SERVICE_URL = 'http://auth-service'; // Auth service URL

async function main() {
    const app = express();

    app.set("views", path.join(__dirname, "views")); // Set directory that contains templates for views.
    app.set("view engine", "hbs"); // Use hbs as the view engine for Express.
    
    app.use(express.static("public"));
    app.use(cookieParser());

    app.use((req, res, next) => {
        const openRoutes = ['/login', '/register'];
        if (openRoutes.includes(req.path) || req.path.startsWith('/public')) {
            return next();
        }
        authenticateToken(req, res, next);
    });

    // Enables JSON body parsing for HTTP requests
    app.use(express.json());
    
    app.use(bodyParser.urlencoded({ extended: true }));
    

    //
    // Web page for user login
    //
    app.get("/login", (req, res) => {
        res.render("login", {}); // Render a login form
    });

    //
    // Web page for user registration
    //
    app.get("/register", (req, res) => {
        res.render("register", {}); // Render a registration form
    });

    //
    // Handle user registration
    //
    app.post("/register", async (req, res) => {
        try {
            const response = await axios.post(`${AUTH_SERVICE_URL}/register`, req.body);
            res.redirect('/login'); // Redirect to login after successful registration
        } catch (err) {
            console.error("Registration failed", err);
            res.status(400).send("Registration failed");
        }
    });

    //
    // Handle user login and return JWT
    //
    app.post("/login", async (req, res) => {
        try {
            const response = await axios.post(`${AUTH_SERVICE_URL}/login`, req.body);
            const token = response.data.token;
    
            // Send the token in the response body
            res.cookie('jwt', token, {
                httpOnly: true,  // Prevent client-side JS from accessing the cookie
                secure: process.env.NODE_ENV === 'production',  // Only set in HTTPS in production
                maxAge: 24 * 60 * 60 * 1000  // 1 day expiration
            });

            res.redirect('/');
            } catch (err) {
            console.error("Login failed", err);
            res.status(400).send("Login failed");
        }
    });

    //
    // Main web page that lists videos.
    //
    app.get("/", async (req, res) => {
        console.log("here")
        // Retreives the list of videos from the metadata microservice.
        const videosResponse = await axios.get("http://metadata/videos");

        // Renders the video list for display in the browser.
        res.render("video-list", { videos: videosResponse.data.videos });
    });

    //
    // Web page to play a particular video.
    //
    app.get("/video", async (req, res) => {

        const videoId = req.query.id;

        // Retreives the data from the metadata microservice.
        const videoResponse = await axios.get(`http://metadata/video?id=${videoId}`);

        const video = {
            metadata: videoResponse.data.video,
            url: `/api/video?id=${videoId}`,
        };
        
        // Renders the video for display in the browser.
        res.render("play-video", { video });
    });

    //
    // Web page to upload a new video.
    //
    app.get("/upload", (req, res) => {
        res.render("upload-video", { user: req.user });
    });

    //
    // Web page to show the user's viewing history.
    //
    app.get("/history", async (req, res) => {

        // Retreives the data from the history microservice.
        const historyResponse = await axios.get("http://history/history");

        // Renders the history for display in the browser.
        res.render("history", { videos: historyResponse.data.history });
    });

    //
    // HTTP GET route that streams video to the user's browser.
    //
    app.get("/api/video", async (req, res) => {

        const response = await axios({ // Forwards the request to the video-streaming microservice.
            method: "GET",
            url: `http://video-streaming/video?id=${req.query.id}`, 
            data: req, 
            responseType: "stream",
        });
        response.data.pipe(res);
    });

    //
    // HTTP POST route to upload video from the user's browser.
    //
    app.post("/api/upload", async (req, res) => {

        const response = await axios({ // Forwards the request to the video-upload microservice.
            method: "POST",
            url: "http://video-upload/upload", 
            data: req, 
            responseType: "stream",
            headers: {
                "content-type": req.headers["content-type"],
                "file-name": req.headers["file-name"],
            },
        });
        response.data.pipe(res);
    });

    app.listen(PORT, () => {
        console.log("Gateway microservice online.");
    });
}

main()
    .catch(err => {
        console.error("Gateway microservice failed to start.");
        console.error(err && err.stack || err);
    });
