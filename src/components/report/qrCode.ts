import QRCode from "qrcode";

const QUIET_ZONE = 4;

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[
        character
      ] ?? character,
  );
}

/** Build a self-contained SVG data URL for the shared report QR code. */
export function buildQrCodeSvgDataUrl(value: string): string {
  const qr = QRCode.create(value || "PathForge report", {
    errorCorrectionLevel: "M",
  });
  const size = qr.modules.size;
  const total = size + QUIET_ZONE * 2;
  const cells: string[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (qr.modules.data[row * size + column]) {
        cells.push(
          `<rect x="${column + QUIET_ZONE}" y="${row + QUIET_ZONE}" width="1" height="1"/>`,
        );
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${escapeXml(value || "PathForge report")}"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${cells.join("")}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Build a PNG data URL for jsPDF, which has broad PNG support. */
export function buildQrCodePngDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value || "PathForge report", {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: { dark: "#111111", light: "#ffffff" },
  });
}
