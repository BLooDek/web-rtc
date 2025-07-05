import express from "express";
import { handleConnection } from "../controllers/signalingController.js";

export default (wsInstance) => {
  const router = express.Router();

  wsInstance.applyTo(router);

  router.ws("/", (ws, req) => {
    handleConnection(ws, wsInstance);
  });

  return router;
};
