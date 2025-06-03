// frontend/src/socket.ts
import { io, Socket } from "socket.io-client";

// Create and export a single socket instance
const socket: Socket = io("http://localhost:8081");

export default socket;
