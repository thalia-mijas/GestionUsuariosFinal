const net = require("net");

const host = process.env.DB_HOST || "localhost";
const port = process.env.DB_PORT || 3306;
const retryInterval = 2000; // 2 segundos

function waitForDB(retries = 30) {
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection(port, host, () => {
        socket.end();
        console.log("✅ Conexión a MySQL exitosa");
        resolve();
      });

      socket.on("error", (err) => {
        if (retries === 0) {
          return reject("❌ No se pudo conectar a MySQL");
        }
        console.log("⏳ Esperando MySQL...", err.code);
        setTimeout(() => tryConnect(--retries), retryInterval);
      });
    };

    tryConnect();
  });
}

waitForDB()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
