use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Keep the database in the OS app-data folder rather than wherever the
            // app happened to be launched from, so it survives updates and moves.
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            app.handle()
                .plugin(tauri_plugin_libsql::init_with_config(
                    tauri_plugin_libsql::Config {
                        base_path: Some(data_dir),
                        encryption: None,
                    },
                ))?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
