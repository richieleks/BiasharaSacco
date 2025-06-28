import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@shared/schema";

export function useWebSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = () => {
    if (!user?.id || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Ensure we have a valid host
    const host = window.location.host;
    if (!host || host === 'undefined' || host.includes('undefined')) {
      console.warn("Invalid host for WebSocket connection:", host);
      return;
    }

    // Handle Replit domain properly
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsUrl;
    
    if (host.includes('replit.dev') || host.includes('repl.co')) {
      // For Replit domains, use the full host
      wsUrl = `${protocol}//${host}/ws`;
    } else if (host.includes('localhost')) {
      // For localhost, ensure port is included
      const port = window.location.port || '5000';
      wsUrl = `${protocol}//localhost:${port}/ws`;
    } else {
      wsUrl = `${protocol}//${host}/ws`;
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        
        // Authenticate with the server
        ws.send(JSON.stringify({
          type: "authenticate",
          userId: user.id
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "authenticated") {
            console.log("WebSocket authenticated");
          } else if (data.type === "notification") {
            // Handle incoming notification
            const notification: Notification = data.data;
            console.log("Received notification:", notification);
            
            // Invalidate notification queries to refresh the UI
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
            queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
            
            // Show browser notification if permission is granted
            if (Notification.permission === "granted") {
              new Notification(notification.title, {
                body: notification.message,
                icon: "/favicon.ico",
                tag: `notification-${notification.id}`,
              });
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        if (user?.id) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        console.error("WebSocket URL was:", wsUrl);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  };

  useEffect(() => {
    if (user?.id) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id]);

  // Request notification permission on first load
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
  };
}