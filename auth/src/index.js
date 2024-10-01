const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongodb = require('mongodb');
const fs = require('fs');



if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

if (!process.env.DBHOST) {
    throw new Error("Please specify the database host using environment variable DBHOST.");
}

if (!process.env.DBNAME) {
    throw new Error("Please specify the name of the database using environment variable DBNAME.");
}

let JWT_SECRET;

if (process.env.NODE_ENV === 'production') {
    JWT_SECRET = fs.readFileSync('/mnt/secrets-store/jwt-secret', 'utf8');
} else {
    JWT_SECRET = process.env.JWT_SECRET;
}

const PORT = process.env.PORT;
const DBHOST = process.env.DBHOST;
const DBNAME = process.env.DBNAME;

async function main() {
    const app = express();
    app.use(express.json());

    const client = await mongodb.MongoClient.connect(DBHOST, { useUnifiedTopology: true });
    const db = client.db(DBNAME);
    const usersCollection = db.collection('users');

    app.post('/register', async (req, res) => {
        const { username, password } = req.body;

        // Check if both username and password are provided
        if (!username || !password) {
            return res.status(400).send('Username and password are required');
        }

        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.status(400).send('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ username, password: hashedPassword });

        res.status(201).send('User registered successfully');
    });

    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(400).send('User not found');
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).send('Invalid password');
        }

        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    });

    app.post('/verify', (req, res) => {
        const token = req.body.token;
        if (!token) return res.status(400).send('No token provided');

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).send('Invalid token');
            res.json({ valid: true, username: user.username });
        });
    });

    // Start the authentication service
    app.listen(PORT, () => {
        console.log(`Auth service running on port ${PORT}`);
    });
}

main().catch(err => {
    console.error('Failed to start authentication microservice');
    console.error(err && err.stack || err);
});
