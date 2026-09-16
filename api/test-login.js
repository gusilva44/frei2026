import http from "node:http";

// Start the server
import "./src/server.js" assert { type: "module" };

// Wait for server to start
await new Promise(r => setTimeout(r, 2000));

// Test login with admin credentials
const options = {
    hostname: "localhost",
    port: 5050,
    path: "/auth/login",
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
};

const req = http.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => data += chunk);
    res.on("end", () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
        // Kill the server after test
        process.exit(0);
    });
});

req.on("error", (e) => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
});

req.write(JSON.stringify({ email: "admin@feira.local", senha: "admin123" }));
req.end();