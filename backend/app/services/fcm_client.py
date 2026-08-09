"""
Firebase Cloud Messaging (FCM) client for push notifications.

Configuration:
  Set FIREBASE_SERVICE_ACCOUNT_JSON as a base64-encoded JSON string in Railway env vars.
  Or set FIREBASE_SERVICE_ACCOUNT_PATH to the path of the service account JSON file.

When neither is configured, the client logs a simulation and returns a mock response.
"""
import base64
import json
import logging
import os
import tempfile
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class FirebaseMessagingClient:
    """
    Thin wrapper around firebase-admin for sending push notifications via FCM.
    Gracefully falls back to simulation when credentials are not configured.
    """

    _initialized: bool = False
    _app = None

    def __init__(self):
        self._initialize()

    def _initialize(self):
        """Initialize the Firebase Admin SDK from environment variables."""
        if FirebaseMessagingClient._initialized:
            return

        try:
            import firebase_admin
            from firebase_admin import credentials

            # Option 1: Base64-encoded JSON in env var
            encoded = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
            if encoded:
                try:
                    decoded = base64.b64decode(encoded).decode("utf-8")
                    service_account = json.loads(decoded)
                    cred = credentials.Certificate(service_account)
                    if not firebase_admin._apps:
                        FirebaseMessagingClient._app = firebase_admin.initialize_app(cred)
                    FirebaseMessagingClient._initialized = True
                    logger.info("Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT_JSON env var.")
                    return
                except Exception as e:
                    logger.warning(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

            # Option 2: Path to service account JSON file
            path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
            if path and os.path.exists(path):
                cred = credentials.Certificate(path)
                if not firebase_admin._apps:
                    FirebaseMessagingClient._app = firebase_admin.initialize_app(cred)
                FirebaseMessagingClient._initialized = True
                logger.info(f"Firebase Admin SDK initialized from file: {path}")
                return

            logger.info("Firebase credentials not configured. Push notifications will be simulated.")
        except ImportError:
            logger.info("firebase-admin package not installed. Push notifications will be simulated.")
        except Exception as e:
            logger.warning(f"Firebase initialization failed: {e}. Push notifications will be simulated.")

    def _is_configured(self) -> bool:
        return FirebaseMessagingClient._initialized

    def send_to_token(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send a push notification to a specific device token.

        Args:
            device_token: FCM device registration token
            title: Notification title
            body: Notification body text
            data: Optional key-value data payload (must be Dict[str, str])
            image_url: Optional image URL for rich notifications

        Returns:
            {"success": True/False, "message_id": ..., "gateway": "fcm" | "simulated"}
        """
        if not device_token or not device_token.strip():
            logger.warning("FCM: empty device token — skipping push notification.")
            return {"success": False, "error": "empty_token", "gateway": "fcm"}

        if not self._is_configured():
            logger.info(f"[FCM Simulation] → {device_token[:20]}... | {title}: {body}")
            return {
                "success": True,
                "message_id": f"sim_{device_token[:8]}",
                "gateway": "fcm_simulated",
                "title": title,
                "body": body,
            }

        try:
            from firebase_admin import messaging

            notification = messaging.Notification(title=title, body=body)
            if image_url:
                notification = messaging.Notification(title=title, body=body, image=image_url)

            msg = messaging.Message(
                notification=notification,
                data={str(k): str(v) for k, v in (data or {}).items()},
                token=device_token,
                android=messaging.AndroidConfig(priority="high"),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                ),
            )
            message_id = messaging.send(msg)
            logger.info(f"FCM push sent. Message ID: {message_id}")
            return {"success": True, "message_id": message_id, "gateway": "fcm"}
        except Exception as e:
            logger.error(f"FCM send failed for token {device_token[:20]}...: {e}")
            return {"success": False, "error": str(e), "gateway": "fcm"}

    def send_to_multiple(
        self,
        tokens: list,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Send a push notification to multiple device tokens (up to 500)."""
        if not tokens:
            return {"success": True, "sent": 0, "failed": 0}

        if not self._is_configured():
            logger.info(f"[FCM Simulation] Multicast → {len(tokens)} tokens | {title}: {body}")
            return {"success": True, "sent": len(tokens), "failed": 0, "gateway": "fcm_simulated"}

        try:
            from firebase_admin import messaging

            msg = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                data={str(k): str(v) for k, v in (data or {}).items()},
                tokens=tokens[:500],
                android=messaging.AndroidConfig(priority="high"),
            )
            response = messaging.send_each_for_multicast(msg)
            logger.info(
                f"FCM multicast sent to {len(tokens)} tokens. "
                f"Success: {response.success_count}, Failure: {response.failure_count}"
            )
            return {
                "success": True,
                "sent": response.success_count,
                "failed": response.failure_count,
                "gateway": "fcm",
            }
        except Exception as e:
            logger.error(f"FCM multicast failed: {e}")
            return {"success": False, "error": str(e), "sent": 0, "failed": len(tokens), "gateway": "fcm"}


# Singleton instance
_fcm_client: Optional[FirebaseMessagingClient] = None


def get_fcm_client() -> FirebaseMessagingClient:
    """Returns the singleton FCM client instance."""
    global _fcm_client
    if _fcm_client is None:
        _fcm_client = FirebaseMessagingClient()
    return _fcm_client
