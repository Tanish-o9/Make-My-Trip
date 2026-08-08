import pytest
from app.services.diagnostics import provider_diagnostics

def test_all_providers_diagnostics():
    """Diagnostics checks return configurations and status summaries."""
    summary = provider_diagnostics.check_all_providers()
    assert len(summary) == 10
    
    assert "duffel" in summary
    assert summary["duffel"]["provider"] == "Duffel Flights"
    assert "fallback_active" in summary["duffel"]

    assert "hotelbeds" in summary
    assert "status" in summary["hotelbeds"]

    assert "s3" in summary
    assert "latency_ms" in summary["s3"]
