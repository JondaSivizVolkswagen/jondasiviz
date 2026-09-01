//! Arranque de la aplicacion de escritorio. El planner entero (motor, catalogo e
//! interfaz) es el mismo build web que sirve la pagina: aqui solo se abre la ventana
//! que lo carga, para que no haya dos versiones de la herramienta que mantener.

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("no se pudo arrancar la ventana de la aplicacion");
}
