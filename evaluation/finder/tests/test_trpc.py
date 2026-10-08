import unittest

from finder_eval.adapters.aida_trpc import unwrap_trpc_response


class TrpcTest(unittest.TestCase):
    def test_unwraps_superjson(self) -> None:
        self.assertEqual(
            unwrap_trpc_response({"result": {"data": {"json": {"chatId": 7}}}}),
            {"chatId": 7},
        )

    def test_rejects_trpc_error(self) -> None:
        with self.assertRaises(RuntimeError):
            unwrap_trpc_response({"error": {"message": "failure"}})


if __name__ == "__main__":
    unittest.main()
