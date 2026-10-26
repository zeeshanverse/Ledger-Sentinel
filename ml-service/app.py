from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Ledger Sentinel ML Service", version="0.1.0")

class Transaction(BaseModel):
    amount: float = Field(ge=0)
    balanceBefore: float = Field(ge=0)
    balanceAfter: float = Field(ge=0)
    country: str = "IN"
    merchantCategory: str = "GENERAL"
    hour: int = Field(default=12, ge=0, le=23)
    velocity15m: int = Field(default=0, ge=0)

class Prediction(BaseModel):
    probability: float
    modelVersion: str
    reasons: list[str]

def score(t: Transaction) -> Prediction:
    risk = 0.04
    reasons=[]
    ratio = t.amount / max(t.balanceBefore, 1.0)
    if ratio >= 0.80:
        risk += 0.28; reasons.append("transaction consumes most of available balance")
    elif ratio >= 0.50:
        risk += 0.14; reasons.append("high amount-to-balance ratio")
    if t.velocity15m >= 5:
        risk += min(0.25, 0.04 * t.velocity15m); reasons.append("high transaction velocity")
    if t.hour <= 5:
        risk += 0.12; reasons.append("unusual transaction hour")
    if t.merchantCategory.upper() in {"CRYPTO", "GAMBLING", "HIGH_RISK"}:
        risk += 0.16; reasons.append("high-risk merchant category")
    if t.country.upper() not in {"IN", "INDIA"}:
        risk += 0.08; reasons.append("cross-border transaction")
    probability=min(0.99, risk)
    return Prediction(probability=round(probability,4), modelVersion="baseline-risk-v0.1", reasons=reasons or ["no strong anomaly signal"])

@app.get("/health")
def health(): return {"status":"ok","model":"baseline-risk-v0.1"}

@app.post("/predict", response_model=Prediction)
def predict(t: Transaction): return score(t)
