import express from "express";
import expressWs from "express-ws";
import path from "path";
import { fileURLToPath } from "url";
import signalingRouter from "./routes/signalingRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const wsInstance = expressWs(app);

app.use(express.static(path.join(__dirname, "../../public")));

app.use("/", signalingRouter(wsInstance));

export default app;
