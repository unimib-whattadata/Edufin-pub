import unittest

from polyfiqa_eval.adapters.aida_trpc import unwrap_trpc_response


class TrpcTest(unittest.TestCase):
    def test_unwraps_superjson_response(self) -> None:
        payload = {"result": {"data": {"json": {"chatId": 10}, "meta": {}}}}
        self.assertEqual(unwrap_trpc_response(payload), {"chatId": 10})

    def test_unwraps_one_element_batch(self) -> None:
        payload = [{"result": {"data": {"json": {"ok": True}}}}]
        self.assertEqual(unwrap_trpc_response(payload), {"ok": True})

    def test_raises_on_trpc_error(self) -> None:
        with self.assertRaises(RuntimeError):
            unwrap_trpc_response({"error": {"message": "bad request"}})


if __name__ == "__main__":
    unittest.main()
