from fastapi.testclient import TestClient
from app import app

client=TestClient(app)

def test_health():
    r=client.get('/health'); assert r.status_code==200; assert r.json()['status']=='ok'

def test_high_risk_transaction():
    r=client.post('/predict', json={'amount':92000,'balanceBefore':100000,'balanceAfter':8000,'country':'IN','merchantCategory':'CRYPTO','hour':2,'velocity15m':7})
    assert r.status_code==200
    body=r.json(); assert body['probability'] >= 0.7; assert body['reasons']
