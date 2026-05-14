import { BASE_URL } from "./api";

export const connectSocket = (onMessage) => {
  const wsUrl = BASE_URL.replace("http://", "ws://").replace("https://", "wss://");
  const socket = new WebSocket(`${wsUrl}/ws`)

  socket.onopen = () => {
    console.log("WebSocket connected")
  }

  socket.onmessage = (event) => {

    const data = JSON.parse(event.data)

    onMessage(data)

  }

  socket.onerror = (error) => {
    console.log("Socket error", error)
  }

  return socket

}