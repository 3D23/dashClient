import { useEffect, useCallback, useState, useRef } from "react";

interface UseWWebSocketProps {
    url: string,
    onMessage: (message: string) => void
}


export const useWebSocket = ({url, onMessage}: UseWWebSocketProps) => {
    const socket = useRef<WebSocket | null>(null)
    const [isConnected, setIsConnected] = useState<boolean>(false)

    const sendMessage = useCallback((message: string) => {
        if (socket.current && isConnected) {
            socket.current.send(message)
        }
    }, [socket, isConnected])

    useEffect(() => {
        const ws = new WebSocket(url)
        ws.onopen = () => {
            setIsConnected(true)
            console.log('Соединение установлено')
        }

        ws.onmessage = (ev) => {
            onMessage(ev.data)
        }

        ws.onclose = () => {
            setIsConnected(false)
            console.log('Соединение разорвано')
        }

        socket.current = ws

        return () => {
            ws.close()
        }
    }, [url, onMessage])

    return { sendMessage, isConnected }
}