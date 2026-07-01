import app from "./app";

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
