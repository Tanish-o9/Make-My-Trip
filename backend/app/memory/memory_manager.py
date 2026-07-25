import os
import json
import logging
from typing import List, Dict, Any, Optional
import redis
import chromadb
from chromadb.config import Settings
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.agents import ConversationSession, UserPreferenceEmbedding

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CHROMADB_HOST = os.getenv("CHROMADB_HOST", "localhost")
CHROMADB_PORT = os.getenv("CHROMADB_PORT", "8000")

class MemoryManager:
    _redis_client = None
    _chroma_client = None

    @classmethod
    def _get_redis(cls):
        if cls._redis_client is None:
            try:
                cls._redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
            except Exception as e:
                logger.warning(f"MemoryManager failed to connect to Redis: {e}")
        return cls._redis_client

    @classmethod
    def _get_chroma(cls):
        if cls._chroma_client is None:
            try:
                cls._chroma_client = chromadb.HttpClient(
                    host=CHROMADB_HOST,
                    port=int(CHROMADB_PORT)
                )
            except Exception as e:
                logger.warning(f"MemoryManager failed to connect to ChromaDB: {e}")
        return cls._chroma_client

    # --- Short-term Memory (Redis-backed conversation buffer) ---
    @classmethod
    def get_conversation_history(cls, session_id: str) -> List[Dict[str, Any]]:
        r = cls._get_redis()
        if r:
            try:
                history_data = r.get(f"chat:history:{session_id}")
                if history_data:
                    return json.loads(history_data)
            except Exception as e:
                logger.error(f"Error reading conversation history from Redis: {e}")

        # Fallback to Database
        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if sess:
                # Cache it back in Redis if we can
                if r:
                    try:
                        r.setex(f"chat:history:{session_id}", 3600, json.dumps(sess.messages_json))
                    except Exception:
                        pass
                return sess.messages_json
        finally:
            db.close()
        return []

    @classmethod
    def save_conversation_history(cls, session_id: str, messages: List[Dict[str, Any]], user_id: int):
        # 1. Save to Redis
        r = cls._get_redis()
        if r:
            try:
                r.setex(f"chat:history:{session_id}", 3600, json.dumps(messages))
            except Exception as e:
                logger.error(f"Error saving conversation history to Redis: {e}")

        # 2. Save to Database for persistence
        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if not sess:
                sess = ConversationSession(session_id=session_id, user_id=user_id, messages_json=messages)
                db.add(sess)
            else:
                sess.messages_json = messages
            db.commit()
        except Exception as e:
            logger.error(f"Error saving conversation history to DB: {e}")
        finally:
            db.close()

    # --- Long-term Memory (ChromaDB Vector embeddings of past travel preferences) ---
    @classmethod
    def save_user_preference(cls, user_id: int, preference_text: str, category: str = "general"):
        db: Session = SessionLocal()
        chroma = cls._chroma_client or cls._get_chroma()
        doc_id = f"pref_{user_id}_{int(hash(preference_text)) % 1000000}"

        try:
            if chroma:
                collection = chroma.get_or_create_collection("user_preferences")
                # Embed and add
                collection.add(
                    documents=[preference_text],
                    ids=[doc_id],
                    metadatas=[{"user_id": user_id, "category": category}]
                )
                
                # Log reference in Postgres
                pref_entry = UserPreferenceEmbedding(
                    user_id=user_id,
                    chromadb_collection="user_preferences",
                    chromadb_doc_id=doc_id,
                    preference_category=category,
                    summary_text=preference_text
                )
                db.add(pref_entry)
                db.commit()
                logger.info(f"Saved preference embedding in ChromaDB for user {user_id}")
            else:
                logger.warning("ChromaDB unavailable. Logging preference in PostgreSQL only.")
                # Log preference in PostgreSQL only
                pref_entry = UserPreferenceEmbedding(
                    user_id=user_id,
                    chromadb_collection="postgres_only",
                    chromadb_doc_id=doc_id,
                    preference_category=category,
                    summary_text=preference_text
                )
                db.add(pref_entry)
                db.commit()
        except Exception as e:
            logger.error(f"Failed to save user preference embedding: {e}")
        finally:
            db.close()

    @classmethod
    def query_user_preferences(cls, user_id: int, query: str, limit: int = 3) -> List[str]:
        chroma = cls._chroma_client or cls._get_chroma()
        if not chroma:
            logger.warning("ChromaDB client not connected. Falling back to DB keyword search.")
            db: Session = SessionLocal()
            try:
                results = db.query(UserPreferenceEmbedding).filter(
                    UserPreferenceEmbedding.user_id == user_id
                ).limit(limit).all()
                return [r.summary_text for r in results]
            except Exception as e:
                logger.error(f"Error querying user preference database: {e}")
                return []
            finally:
                db.close()

        try:
            collection = chroma.get_or_create_collection("user_preferences")
            results = collection.query(
                query_texts=[query],
                where={"user_id": user_id},
                n_results=limit
            )
            if results and results.get("documents"):
                return results["documents"][0]
        except Exception as e:
            logger.error(f"Failed to query ChromaDB user preferences: {e}")
        return []
