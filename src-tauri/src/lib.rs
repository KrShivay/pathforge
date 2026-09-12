#[cfg(desktop)]
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                let refresh_item = MenuItemBuilder::new("Refresh")
                    .id("refresh")
                    .accelerator("CmdOrCtrl+R")
                    .build(app)?;
                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(&refresh_item)
                    .build()?;
                let menu = MenuBuilder::new(app).item(&view_menu).build()?;
                app.set_menu(menu)?;
            }

            Ok(())
        });

    #[cfg(desktop)]
    let builder = builder.on_menu_event(|app, event| {
        if event.id() == "refresh" {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = window.eval("window.location.reload()") {
                    log::error!("Failed to refresh the main window: {error}");
                }
            }
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
