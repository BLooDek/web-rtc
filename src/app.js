import express from "express";
import expressWs from "express-ws";
import path from "path";
import { fileURLToPath } from "url";
import { handleConnection } from "./controllers/signalingController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const wsInstance = expressWs(app);

app.use(express.static(path.join(__dirname, "../../public")));

app.ws("/", (ws, req) => {
  handleConnection(ws, wsInstance);
});

export default app;
