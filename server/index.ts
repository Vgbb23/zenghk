import express from "express";
import { createPixCharge, getHealth, getOrder } from "../api/lib/fruitfy.js";

const app = express();
app.use(express.json());

app.post("/api/pix/charge", async (req, res) => {
  const result = await createPixCharge(req.body);
  return res.status(result.status).json(result.body);
});

app.get("/api/order/:orderId", async (req, res) => {
  const result = await getOrder(req.params.orderId);
  return res.status(result.status).json(result.body);
});

app.get("/api/health", (_req, res) => {
  const result = getHealth();
  return res.status(result.status).json(result.body);
});

const PORT = Number(process.env.API_PORT || 3002);

const server = app.listen(PORT, () => {
  console.log(`Fruitfy API bridge rodando na porta ${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Porta ${PORT} já está em uso. Encerre o processo ou defina API_PORT no .env.local (ex.: 3002).`
    );
    process.exit(1);
  }
  throw err;
});
