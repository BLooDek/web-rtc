import http from "http";
import express from "express";
import expressWs from "express-ws";
import path from "path";
import { fileURLToPath } from "url";
import signalingRouter from "./src/routes/signalingRoutes.js";

const app = express();
const server = http.createServer(app);
const wsInstance = expressWs(app, server);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use("/", signalingRouter(wsInstance));

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
