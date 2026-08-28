// Sin consola detras de la ventana en Windows cuando es una build de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jondasiviz_lib::run()
}
