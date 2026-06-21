import { io, type Socket } from 'socket.io-client'
import { appConfig } from '@/config/app.config'

let socket: Socket | null = null

export const getSocket = (): Socket => {
  const token = localStorage.getItem('interview-mate-token')

  if (!socket) {
    socket = io(appConfig.socketUrl, {
      autoConnect: false,
      auth: { token },
      transports: ['websocket', 'polling'],
    })
  }

  socket.auth = { token }
  return socket
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}
