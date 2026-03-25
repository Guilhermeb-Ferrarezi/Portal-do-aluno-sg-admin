const net = require("net");

const remoteHost = process.env.REMOTE_DB_HOST || process.env.DB_SERVER;
const remotePort = Number(process.env.REMOTE_DB_PORT || process.env.DB_PORT || 15500);
const localHost = process.env.LOCAL_DB_PROXY_HOST || "0.0.0.0";
const localPort = Number(process.env.LOCAL_DB_PROXY_PORT || 15432);

if (!remoteHost || !Number.isFinite(remotePort)) {
  throw new Error("Configure REMOTE_DB_HOST/REMOTE_DB_PORT (ou DB_SERVER/DB_PORT) para iniciar o proxy.");
}

const server = net.createServer((clientSocket) => {
  const upstreamSocket = net.createConnection({
    host: remoteHost,
    port: remotePort,
  });

  clientSocket.pipe(upstreamSocket);
  upstreamSocket.pipe(clientSocket);

  const closePair = () => {
    if (!clientSocket.destroyed) clientSocket.destroy();
    if (!upstreamSocket.destroyed) upstreamSocket.destroy();
  };

  clientSocket.on("error", closePair);
  upstreamSocket.on("error", closePair);
  clientSocket.on("close", closePair);
  upstreamSocket.on("close", closePair);
});

server.on("error", (error) => {
  console.error("[remote-db-proxy] erro:", error);
  process.exit(1);
});

server.listen(localPort, localHost, () => {
  console.log(`[remote-db-proxy] ouvindo em ${localHost}:${localPort} -> ${remoteHost}:${remotePort}`);
});
