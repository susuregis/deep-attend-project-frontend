import { io, Socket } from "socket.io-client";
import { API_URL } from "./config/api";

let socket: Socket | null = null;

export function connectSocket() {
  if (!socket) {
    socket = io(API_URL, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
  }
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
