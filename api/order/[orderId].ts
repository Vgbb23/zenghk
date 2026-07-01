import { getOrder } from "../lib/fruitfy.js";

type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const raw = req.query.orderId;
  const orderId = Array.isArray(raw) ? raw[0] : raw;
  const result = await getOrder(orderId);
  return res.status(result.status).json(result.body);
}
