const fs = require("fs");
const path = require("path");
const { PKPass } = require("passkit-generator");

// Esta función atenderá URLs tipo:
// /api/passkit/v1/passes/pass.com.ramongaynor.vertex.lealtad/C-00027
// gracias al rewrite del vercel.json
module.exports = async (req, res) => {
  const { passTypeIdentifier, serialNumber } = req.query;

  try {
    const baseDir = path.join(process.cwd(), "passkit");
    const certsPath = path.join(baseDir, "certs");
    const modelPath = path.join(baseDir, "model.pass");

    const wwdr = fs.readFileSync(path.join(certsPath, "wwdr.pem"));
    const signerCert = fs.readFileSync(path.join(certsPath, "pass_cert.pem"));
    const signerKey = fs.readFileSync(path.join(certsPath, "passkey.key"));

    // TODO: aquí luego leerás BD por serialNumber
    const cliente = {
      id: serialNumber,
      nombre: "CLIENTE DEMO",
      nivel: "Estudiante",
      puntos: 120
    };

    const pass = await PKPass.from(
      {
        model: modelPath,
        certificates: {
          wwdr,
          signerCert,
          signerKey
        }
      },
      {
        serialNumber: String(cliente.id)
      }
    );

    if (pass.headerFields?.length) {
      pass.headerFields[0].value = cliente.nivel;
    }

    if (pass.primaryFields?.length) {
      pass.primaryFields[0].value = cliente.puntos; // PUNTOS
    }

    if (pass.secondaryFields?.length) {
      pass.secondaryFields[0].value = cliente.nombre;
    }

    if (pass.auxiliaryFields?.length) {
      pass.auxiliaryFields[0].value = cliente.id;
    }

    pass.setBarcodes({
      message: String(cliente.id),
      format: "PKBarcodeFormatPDF417",
      messageEncoding: "iso-8859-1",
      altText: String(cliente.id)
    });

    const buffer = pass.getAsBuffer();

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tarjeta-${cliente.id}.pkpass`
    );
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Error generando pase:", err);
    res.status(500).json({ error: "Error generando pase", detail: err.message });
  }
};
