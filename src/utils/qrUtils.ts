import QRCode from 'qrcode';

export interface QRRenderOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  width?: number;
}

export async function generateQRDataUrl(
  text: string,
  options: QRRenderOptions = {}
): Promise<string> {
  const { errorCorrectionLevel = 'M', margin = 2, width = 240 } = options;

  return QRCode.toDataURL(text, {
    errorCorrectionLevel,
    margin,
    width,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}
