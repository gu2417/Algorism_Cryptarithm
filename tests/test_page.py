import unittest
from app import create_app


class PageTests(unittest.TestCase):
    def test_home_serves_simulator_and_assets(self):
        client = create_app({'TESTING': True}).test_client()
        response = client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('복면산', response.get_data(as_text=True))
        for path in ('/static/css/style.css', '/static/js/app.js'):
            asset = client.get(path)
            self.assertEqual(asset.status_code, 200)
            asset.close()


if __name__ == '__main__':
    unittest.main()
