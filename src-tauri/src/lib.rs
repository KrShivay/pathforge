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
                let undo_item = MenuItemBuilder::new("Undo").id("undo").build(app)?;
                let redo_item = MenuItemBuilder::new("Redo").id("redo").build(app)?;
                let cut_item = MenuItemBuilder::new("Cut").id("cut").build(app)?;
                let copy_item = MenuItemBuilder::new("Copy").id("copy").build(app)?;
                let paste_item = MenuItemBuilder::new("Paste").id("paste").build(app)?;
                let select_all_item = MenuItemBuilder::new("Select All")
                    .id("select_all")
                    .build(app)?;
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .item(&undo_item)
                    .item(&redo_item)
                    .separator()
                    .item(&cut_item)
                    .item(&copy_item)
                    .item(&paste_item)
                    .item(&select_all_item)
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .item(&edit_menu)
                    .item(&view_menu)
                    .build()?;
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
            return;
        }

        let edit_action = match event.id().as_ref() {
            "undo" => Some("undo"),
            "redo" => Some("redo"),
            "cut" => Some("cut"),
            "copy" => Some("copy"),
            "paste" => Some("paste"),
            "select_all" => Some("selectAll"),
            _ => None,
        };

        if let Some(action) = edit_action {
            if let Some(window) = app.get_webview_window("main") {
                let script = format!("window.__pathforgeNativeMenuAction?.('{action}')");
                if let Err(error) = window.eval(&script) {
                    log::error!("Failed to run Edit menu action '{action}': {error}");
                }
            }
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
