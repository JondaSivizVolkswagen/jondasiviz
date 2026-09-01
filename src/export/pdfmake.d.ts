// pdfmake publica los tipos en la raíz del paquete, pero en el navegador hay que
// importar los bundles de build/, que no los llevan. Se los prestamos aquí.

declare module "pdfmake/build/pdfmake" {
  const pdfMake: typeof import("pdfmake");
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: import("pdfmake/interfaces").TVirtualFileSystem;
  export default vfs;
}
