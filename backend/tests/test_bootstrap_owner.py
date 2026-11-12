import unittest

from app.bootstrap_owner import validate_owner_credentials


class OwnerCredentialTests(unittest.TestCase):
    def test_valid_credentials_are_normalized(self):
        self.assertEqual(
            validate_owner_credentials(
                " Owner@Example.com ",
                "correct-horse-battery",
                "correct-horse-battery",
            ),
            ("owner@example.com", "correct-horse-battery"),
        )

    def test_rejects_mismatched_passwords(self):
        with self.assertRaisesRegex(ValueError, "Passwords do not match"):
            validate_owner_credentials(
                "owner@example.com",
                "correct-horse-battery",
                "different-password",
            )

    def test_rejects_short_passwords(self):
        with self.assertRaisesRegex(ValueError, "12 and 128 characters"):
            validate_owner_credentials(
                "owner@example.com",
                "too-short",
                "too-short",
            )


if __name__ == "__main__":
    unittest.main()
