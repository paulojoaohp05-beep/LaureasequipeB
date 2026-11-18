/** File → base64 em blocos (btoa não aceita strings grandes de uma vez). */
export async function arquivoParaBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binario);
}
