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

    _redis_offline_until = 0.0

    @classmethod
    def _get_redis(cls):
        import time
        import socket
        from urllib.parse import urlparse
        now = time.time()
        if now < cls._redis_offline_until:
            return None

        if cls._redis_client is None:
            try:
                parsed = urlparse(REDIS_URL)
                host = parsed.hostname or "localhost"
                port = parsed.port or 6379
                # 200ms connection test
                with socket.create_connection((host, int(port)), timeout=0.2):
                    pass
                cls._redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=1.0)
            except Exception as e:
                logger.warning(f"Redis is offline at {REDIS_URL}. Bypassing for 30s. Error: {e}")
                cls._redis_client = None
                cls._redis_offline_until = now + 30.0
        return cls._redis_client

    _chroma_offline_until = 0.0

    @classmethod
    def _get_chroma(cls):
        import time
        import socket
        now = time.time()
        if now < cls._chroma_offline_until:
            return None

        if cls._chroma_client is None:
            try:
                # 200ms socket connection test
                with socket.create_connection((CHROMADB_HOST, int(CHROMADB_PORT)), timeout=0.2):
                    pass
                cls._chroma_client = chromadb.HttpClient(
                    host=CHROMADB_HOST,
                    port=int(CHROMADB_PORT)
                )
            except Exception as e:
                logger.warning(f"ChromaDB is offline at {CHROMADB_HOST}:{CHROMADB_PORT}. Bypassing for 30s. Error: {e}")
                cls._chroma_client = None
                cls._chroma_offline_until = now + 30.0
        return cls._chroma_client

    # --- Short-term Memory (Redis-backed conversation buffer) ---
    @classmethod
    def get_conversation_history(cls, session_id: str) -> List[Dict[str, Any]]:
        """Returns conversation history. Redis (L1) → Postgres (L2) fallback."""
        r = cls._get_redis()
        if r:
            try:
                history_data = r.get(f"chat:history:{session_id}")
                if history_data:
                    logger.debug(f"[MEMORY HIT] History for {session_id}: Redis (L1 cache)")
                    return json.loads(history_data)
            except Exception as e:
                logger.error(f"Error reading conversation history from Redis: {e}")

        # Fallback to Database
        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if sess:
                logger.debug(f"[MEMORY HIT] History for {session_id}: PostgreSQL (L2 fallback)")
                # Cache back in Redis for next access
                if r:
                    try:
                        r.setex(f"chat:history:{session_id}", 3600, json.dumps(sess.messages_json))
                    except Exception:
                        pass
                return sess.messages_json or []
        finally:
            db.close()
        return []


    @classmethod
    def save_conversation_history(cls, session_id: str, messages: List[Dict[str, Any]], user_id: int):
        """Saves conversation history. Validates that session belongs to user_id before updating."""
        r = cls._get_redis()
        if r:
            try:
                r.setex(f"chat:history:{session_id}", 3600, json.dumps(messages, default=str))
            except Exception as e:
                logger.error(f"Error saving conversation history to Redis: {e}")

        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if not sess:
                sess = ConversationSession(session_id=session_id, user_id=user_id, messages_json=messages)
                db.add(sess)
            else:
                # Security: only update if the session belongs to this user
                if sess.user_id != user_id:
                    logger.error(f"Session {session_id} belongs to user {sess.user_id}, not {user_id}. Refusing save.")
                    return
                sess.messages_json = messages
            db.commit()
        except Exception as e:
            logger.error(f"Error saving conversation history to DB: {e}")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()


    @classmethod
    def get_active_context(cls, session_id: str) -> Dict[str, Any]:
        r = cls._get_redis()
        if r:
            try:
                context_data = r.get(f"chat:context:{session_id}")
                if context_data:
                    return json.loads(context_data)
            except Exception as e:
                logger.error(f"Error reading active context from Redis: {e}")

        # Fallback to Database
        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if sess and sess.active_agent_context:
                if r:
                    try:
                        r.setex(f"chat:context:{session_id}", 3600, json.dumps(sess.active_agent_context, default=str))
                    except Exception:
                        pass
                return sess.active_agent_context
        finally:
            db.close()
        return {}

    @classmethod
    def save_active_context(cls, session_id: str, context: Dict[str, Any], user_id: int):
        # 1. Save to Redis
        r = cls._get_redis()
        if r:
            try:
                r.setex(f"chat:context:{session_id}", 3600, json.dumps(context, default=str))

            except Exception as e:
                logger.error(f"Error saving active context to Redis: {e}")

        # 2. Save to Database
        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if not sess:
                sess = ConversationSession(session_id=session_id, user_id=user_id, active_agent_context=context)
                db.add(sess)
            else:
                sess.active_agent_context = context
            db.commit()
        except Exception as e:
            logger.error(f"Error saving active context to DB: {e}")
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
        """Returns up to `limit` semantically matched preferences. Uses ChromaDB → Postgres fallback."""
        chroma = cls._chroma_client or cls._get_chroma()
        if not chroma:
            db: Session = SessionLocal()
            try:
                results = db.query(UserPreferenceEmbedding).filter(
                    UserPreferenceEmbedding.user_id == user_id
                ).order_by(UserPreferenceEmbedding.id.desc()).limit(limit).all()
                texts = [r.summary_text for r in results]
                if texts:
                    logger.debug(f"[MEMORY HIT] Preferences for user {user_id}: {len(texts)} hits from PostgreSQL")
                return texts
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
            if results and results.get("documents") and results["documents"][0]:
                texts = results["documents"][0]
                logger.debug(f"[MEMORY HIT] Preferences for user {user_id}: {len(texts)} semantic hits from ChromaDB")
                return texts
        except Exception as e:
            logger.error(f"Failed to query ChromaDB user preferences: {e}")
        return []


    @classmethod
    def get_all_user_preferences(cls, user_id: int) -> Dict[str, List[str]]:
        """Retrieves all long-term preferences for a user, grouped by category.
        Returns a dict like: {airlines: [...], hotels: [...], dietary: [...], travel_style: [...], budget: [...], general: [...]}
        """
        db: Session = SessionLocal()
        categorized: Dict[str, List[str]] = {
            "airlines": [],
            "hotels": [],
            "dietary": [],
            "travel_style": [],
            "budget": [],
            "general": []
        }
        try:
            results = db.query(UserPreferenceEmbedding).filter(
                UserPreferenceEmbedding.user_id == user_id
            ).order_by(UserPreferenceEmbedding.id.desc()).limit(50).all()

            for r in results:
                cat = r.preference_category or "general"
                text = r.summary_text or ""
                if not text:
                    continue
                # Map stored category keys to our standard buckets
                cat_lower = cat.lower()
                if any(k in cat_lower for k in ["airline", "flight", "carrier"]):
                    categorized["airlines"].append(text)
                elif any(k in cat_lower for k in ["hotel", "accommodation", "resort", "stay"]):
                    categorized["hotels"].append(text)
                elif any(k in cat_lower for k in ["food", "diet", "dietary", "vegan", "vegetarian", "allergy"]):
                    categorized["dietary"].append(text)
                elif any(k in cat_lower for k in ["travel_style", "style", "solo", "family", "luxury", "adventure"]):
                    categorized["travel_style"].append(text)
                elif any(k in cat_lower for k in ["budget", "price", "cost", "spend"]):
                    categorized["budget"].append(text)
                else:
                    # Try to auto-categorize from text content
                    text_lower = text.lower()
                    if any(k in text_lower for k in ["indigo", "vistara", "air india", "akasa", "airline", "flight", "business class", "economy", "cabin"]):
                        categorized["airlines"].append(text)
                    elif any(k in text_lower for k in ["taj", "marriott", "oberoi", "hyatt", "hilton", "hotel", "resort", "stay"]):
                        categorized["hotels"].append(text)
                    elif any(k in text_lower for k in ["vegan", "vegetarian", "halal", "gluten", "food", "diet"]):
                        categorized["dietary"].append(text)
                    elif any(k in text_lower for k in ["budget", "₹", "spend", "cheap", "luxury", "affordable"]):
                        categorized["budget"].append(text)
                    else:
                        categorized["general"].append(text)
        except Exception as e:
            logger.error(f"Failed to retrieve all preferences for user {user_id}: {e}")
        finally:
            db.close()

        # Deduplicate each category
        for cat in categorized:
            seen = set()
            deduped = []
            for item in categorized[cat]:
                if item not in seen:
                    seen.add(item)
                    deduped.append(item)
            categorized[cat] = deduped[:10]  # Cap at 10 per category

        return categorized

    @classmethod
    def clear_active_context(cls, session_id: str):
        """Resets the active trip context for a session (e.g. on chat reset)."""
        r = cls._get_redis()
        if r:
            try:
                r.delete(f"chat:context:{session_id}")
                r.delete(f"chat:history:{session_id}")
            except Exception as e:
                logger.error(f"Error clearing context from Redis: {e}")
        db: Session = SessionLocal()
        try:
            sess = db.query(ConversationSession).filter(ConversationSession.session_id == session_id).first()
            if sess:
                sess.messages_json = []
                sess.active_agent_context = {}
                db.commit()
        except Exception as e:
            logger.error(f"Error clearing context from DB: {e}")
        finally:
            db.close()
