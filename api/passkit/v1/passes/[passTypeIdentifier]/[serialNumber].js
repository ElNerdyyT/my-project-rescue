const fs = require("fs");
const path = require("path");
const { PKPass } = require("passkit-generator");

module.exports = async (req, res) => {
  const { passTypeIdentifier, serialNumber } = req.query;

  try {
    // Carpeta base donde pusimos modelo y certs
    const baseDir = path.join(process.cwd(), "passkit");
    const certsPath = path.join(baseDir, "certs");
    const modelPath = path.join(baseDir, "model.pass");

    const wwdr = fs.readFileSync(path.join(certsPath, "wwdr.pem"));
    const signerCert = fs.readFileSync(path.join(certsPath, "pass_cert.pem"));
    const signerKey = fs.readFileSync(path.join(certsPath, "passkey.key"));

    // TODO: aquí luego leerás BD por serialNumber (idCliente)
    // De momento, datos de ejemplo:
    const cliente = {
      id: serialNumber,
      nombre: "CLIENTE DEMO",
      nivel: "Estudiante",
      puntos: 120
    };

    // Crear el pase desde el modelo
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
        // Si quieres, aquí puedes sobreescribir authenticationToken, etc.
      }
    );

    // Nivel (headerFields)
    if (pass.headerFields && pass.headerFields.length > 0) {
      pass.headerFields[0].value = cliente.nivel;
    }

    // PUNTOS (primaryFields, según Fase 1)
    if (pass.primaryFields && pass.primaryFields.length > 0) {
      pass.primaryFields[0].value = cliente.puntos;
    }

    // Nombre (secondaryFields)
    if (pass.secondaryFields && pass.secondaryFields.length > 0) {
      pass.secondaryFields[0].value = cliente.nombre;
    }

    // # Cliente (auxiliaryFields)
    if (pass.auxiliaryFields && pass.auxiliaryFields.length > 0) {
      pass.auxiliaryFields[0].value = cliente.id;
    }

    // Código PDF417 (igual que en tu index.mjs)
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
    res.status(500).json({
      error: "Error generando pase",
      detail: err.message
    });
  }
};
