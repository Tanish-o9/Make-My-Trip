import os
import joblib
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sklearn.ensemble import RandomForestClassifier

# Configure local directory for model storage
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "fraud_model.joblib")

router = APIRouter(prefix="/ml", tags=["ml"])

class FraudInferenceRequest(BaseModel):
    ip_mismatch: int          # 1 if IP country != Card country, else 0
    recent_bookings_count: int  # count of bookings in past hour
    card_status_invalid: int   # 1 if card token has failed flags, else 0
    transaction_amount: float  # total transaction size in INR

class FraudInferenceResponse(BaseModel):
    risk_score: float          # predicted probability of fraud (0.0 to 1.0)
    verdict: str               # allow, review, or block

def train_and_save_model():
    """Trains a RandomForestClassifier on synthetic transaction features and saves it"""
    # X features: [ip_mismatch, recent_bookings_count, card_status_invalid, transaction_amount]
    # Class labels: 0 (legitimate), 1 (fraudulent)
    X = np.array([
        [0, 0, 0, 1500.0],
        [0, 1, 0, 3000.0],
        [0, 0, 0, 500.0],
        [1, 0, 0, 12000.0], # suspicious location mismatch
        [1, 3, 0, 25000.0], # highly suspicious: mismatch + velocity
        [0, 0, 1, 5000.0],  # invalid card attempt
        [1, 4, 1, 45000.0], # definite fraud
        [0, 1, 0, 1500.0],
        [0, 0, 0, 2000.0],
        [1, 0, 1, 8000.0]
    ])
    y = np.array([0, 0, 0, 0, 1, 1, 1, 0, 0, 1])

    # Fit Random Forest Classifier
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    model.fit(X, y)
    
    # Save to local workspace directory
    joblib.dump(model, MODEL_PATH)
    print(f"Fraud Detection ML Model trained and versioned successfully at {MODEL_PATH}")
    return model

def get_trained_model():
    """Loads the serialized model or trains a new one if missing"""
    if not os.path.exists(MODEL_PATH):
        try:
            return train_and_save_model()
        except Exception:
            # Return a simple mock fallback classifier if scikit-learn training fails
            class FallbackClassifier:
                def predict_proba(self, X):
                    # Estimate probability heuristically from X
                    # X[0] = ip_mismatch, X[1] = bookings, X[2] = card_invalid, X[3] = amount
                    score = 0.0
                    if X[0][0] > 0: score += 0.4
                    if X[0][1] >= 3: score += 0.4
                    if X[0][2] > 0: score += 0.5
                    return np.array([[1 - min(score, 1.0), min(score, 1.0)]])
            return FallbackClassifier()
    return joblib.load(MODEL_PATH)

# Load global model instance
fraud_classifier = get_trained_model()

@router.post("/fraud-predict", response_model=FraudInferenceResponse)
def predict_fraud_risk(req: FraudInferenceRequest):
    try:
        features = np.array([[
            req.ip_mismatch,
            req.recent_bookings_count,
            req.card_status_invalid,
            req.transaction_amount
        ]])
        
        # Calculate risk probability of class 1 (fraud)
        probabilities = fraud_classifier.predict_proba(features)
        risk_score = float(probabilities[0][1])

        # Assign verdict based on thresholds
        if risk_score >= 0.80:
            verdict = "block"
        elif risk_score >= 0.40:
            verdict = "review"
        else:
            verdict = "allow"

        return {
            "risk_score": round(risk_score, 2),
            "verdict": verdict
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference pipeline failure: {e}")

if __name__ == '__main__':
    train_and_save_model()
