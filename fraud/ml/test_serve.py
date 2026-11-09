import unittest
from pathlib import Path

from serve import create_app


class ModelApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = create_app(Path(__file__).parent / "model").test_client()

    def test_health_reports_model_version(self):
        response = self.client.get("/health")
        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["modelVersion"].startswith("isolation-forest:"))
        self.assertEqual(payload["features"], 17)

    def test_score_validates_and_scores_feature_rows(self):
        health = self.client.get("/health").get_json()
        bad = self.client.post("/score", json={"rows": [{}]})
        self.assertEqual(bad.status_code, 400)

        row = {
            "n_donations": 10, "n_unique_donors": 9, "repeat_ratio": 0.1,
            "raised_ratio": 0.4, "top_donor_share": 0.2, "max_single_ratio": 0.2,
            "cv_amount": 0.4, "top_amount_repeat_share": 0.2, "first_hour_share": 0.1,
            "max_burst": 2, "interval_cv": 0.6, "payout_differs": 0,
            "payout_shared_owners": 1, "owner_campaign_count": 1, "owner_burst": 1,
            "payout_burst": 1, "self_donation_share": 0,
        }
        response = self.client.post("/score", json={"rows": [row]})
        payload = response.get_json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["modelVersion"], health["modelVersion"])
        self.assertEqual(len(payload["scores"]), 1)
        self.assertGreaterEqual(payload["scores"][0]["score"], 0)
        self.assertLessEqual(payload["scores"][0]["score"], 1)

    def test_score_rejects_oversized_batches(self):
        response = self.client.post("/score", json={"rows": [{}] * 501})
        self.assertEqual(response.status_code, 413)


if __name__ == "__main__":
    unittest.main()
