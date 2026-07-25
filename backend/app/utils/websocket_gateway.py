import os
import json
import logging
import asyncio
from typing import Dict, Set, Any
from fastapi import WebSocket
import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class ConnectionManager:
    def __init__(self):
        # Maps active WebSocket to their subscribed topics
        self.active_connections: Dict[WebSocket, Set[str]] = {}
        self.redis_client = None
        self.pubsub = None
        self._listener_task = None

    def _get_redis(self):
        if self.redis_client is None:
            try:
                self.redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
            except Exception as e:
                logger.error(f"WebSocket ConnectionManager failed to load Redis: {e}")
        return self.redis_client

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[websocket] = set()
        logger.info(f"New WebSocket client registered. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    def subscribe(self, websocket: WebSocket, topic: str):
        if websocket in self.active_connections:
            self.active_connections[websocket].add(topic)
            logger.info(f"Client subscribed to topic: {topic}")

    def unsubscribe(self, websocket: WebSocket, topic: str):
        if websocket in self.active_connections:
            self.active_connections[websocket].discard(topic)
            logger.info(f"Client unsubscribed from topic: {topic}")

    async def broadcast_to_topic(self, topic: str, message: Any):
        """Sends message to all local WebSocket connections subscribed to target topic"""
        payload = json.dumps({"topic": topic, "data": message})
        targets = [ws for ws, topics in self.active_connections.items() if topic in topics]
        
        if targets:
            await asyncio.gather(*[ws.send_text(payload) for ws in targets], return_exceptions=True)

    def publish_to_redis(self, topic: str, message: Any):
        """Publishes message to Redis Pub/Sub, enabling multi-instance scaling"""
        r = self._get_redis()
        if r:
            try:
                r.publish(topic, json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to publish message to Redis: {e}")

    def start_redis_listener(self, loop: asyncio.AbstractEventLoop):
        """Starts a background thread to listen for Redis pub/sub messages and forward them"""
        r = self._get_redis()
        if not r:
            logger.warning("Redis unavailable. Local routing only.")
            return

        try:
            self.pubsub = r.pubsub(ignore_subscribe_messages=True)
            # Subscribe to pattern matching all channels
            self.pubsub.psubscribe("*")
            
            def listen():
                for message in self.pubsub.listen():
                    try:
                        channel = message["channel"].decode("utf-8")
                        data = json.loads(message["data"].decode("utf-8"))
                        # Schedule broadcast on the main event loop
                        asyncio.run_coroutine_threadsafe(
                            self.broadcast_to_topic(channel, data),
                            loop
                        )
                    except Exception as e:
                        logger.error(f"Error in Redis listener thread: {e}")

            import threading
            thread = threading.Thread(target=listen, daemon=True)
            thread.start()
            logger.info("Background Redis Pub/Sub message listener initialized.")
        except Exception as e:
            logger.error(f"Failed to initialize Redis Pub/Sub gateway: {e}")

# Global Gateway Instance
ws_gateway = ConnectionManager()
